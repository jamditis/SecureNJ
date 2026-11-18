import { execFile } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * These tests run the script against a local server and a stand-in for the
 * `gh` command. They show the logic of the script. They do not show that
 * GitHub Pages accepts the build request: only a run on GitHub shows that.
 */
const SCRIPT = join(process.cwd(), 'scripts/wait-for-live-site.sh');
const NEW_PAGE = '<!doctype html><title>new build</title>';
const OLD_PAGE = '<!doctype html><title>old build</title>';

let dir: string;
let server: Server;
let address: string;
/** The page that the local server sends. A test can change it between requests. */
let page: () => string;

const ghLog = () => (existsSync(join(dir, 'gh.log')) ? readFileSync(join(dir, 'gh.log'), 'utf8') : '');

function run(site: string, env: Record<string, string> = {}) {
  return new Promise<{ code: number; output: string }>((resolve) => {
    execFile(
      'bash',
      [SCRIPT, site, join(dir, 'index.html')],
      {
        env: {
          PATH: `${dir}:${process.env.PATH}`,
          GITHUB_REPOSITORY: 'someone/project',
          GH_TOKEN: 'not-a-real-token',
          WAIT_SECONDS: '0.05',
          WAIT_ATTEMPTS: '10',
          ...env,
        },
      },
      (error, stdout, stderr) => resolve({ code: error ? Number(error.code) : 0, output: stdout + stderr }),
    );
  });
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'snj-wait-'));
  writeFileSync(join(dir, 'index.html'), NEW_PAGE);
  // The stand-in for `gh` records its arguments, and exits with GH_EXIT.
  writeFileSync(join(dir, 'gh'), `#!/usr/bin/env bash\necho "$@" >> "${dir}/gh.log"\nexit "\${GH_EXIT:-0}"\n`);
  chmodSync(join(dir, 'gh'), 0o755);
  page = () => NEW_PAGE;
  server = createServer((_request, response) => response.end(page()));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  address = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
  rmSync(dir, { recursive: true, force: true });
});

describe('wait-for-live-site.sh', () => {
  it('passes at once when the site serves the build, with no build request', async () => {
    const result = await run(address);
    expect(result.code).toBe(0);
    expect(result.output).toContain('The live site serves the build');
    expect(ghLog()).toBe('');
  });

  it('accepts an address that ends with a slash', async () => {
    expect((await run(`${address}/`)).code).toBe(0);
  });

  it('asks for a build one time when the site stays old, and passes when the site changes', async () => {
    // The site changes only after the build request, as when the push started no build.
    page = () => (ghLog() ? NEW_PAGE : OLD_PAGE);
    const result = await run(address);
    expect(result.code).toBe(0);
    expect(ghLog().trim().split('\n')).toEqual(['api --method POST repos/someone/project/pages/builds --silent']);
  });

  it('fails with an instruction when the site never serves the build', async () => {
    page = () => OLD_PAGE;
    const result = await run(address);
    expect(result.code).toBe(1);
    expect(result.output).toContain('::error::');
    expect(result.output).toContain('gh-pages');
    expect(ghLog().trim().split('\n')).toHaveLength(1);
  });

  it('continues to wait when the build request fails', async () => {
    let requests = 0;
    // The site changes late, with no help from the build request.
    page = () => (++requests > 6 ? NEW_PAGE : OLD_PAGE);
    const result = await run(address, { GH_EXIT: '1' });
    expect(result.code).toBe(0);
    expect(result.output).toContain('::warning::');
  });

  it('fails when the site gives an error status', async () => {
    server.removeAllListeners('request');
    server.on('request', (_request, response) => {
      response.statusCode = 404;
      response.end(NEW_PAGE);
    });
    expect((await run(address)).code).toBe(1);
  });
});
