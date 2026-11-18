import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AI_PROMPTS, RESOURCE_GROUPS, SOURCE_CODE_URL, SOURCE_DIGEST } from '../content/resources';
import en from '../locales/en/infoPages';
import { TOOLS } from '../tools';
import { makeTranslate, translationOf, type MessageKey } from './i18n';
import { appAddress, copyText, flyerTools, parseRich, shareMessage } from './sharePage';

const tEn = makeTranslate();
const tEs = makeTranslate(translationOf('es'));
const repoFile = (path: string) => new URL(`../${path}`, import.meta.url);

/** The same structure as the script hashes when it reads the source. */
const canonicalContent = () => ({
  groups: RESOURCE_GROUPS.map((group) => ({
    heading: group.heading,
    items: group.items.map((item) => ({ name: item.name, url: item.url, note: item.note })),
  })),
  prompts: AI_PROMPTS.map((prompt) => ({ title: prompt.title, when: prompt.when, text: prompt.text })),
  sourceCodeUrl: SOURCE_CODE_URL,
});

const allUrls = () => [...RESOURCE_GROUPS.flatMap((group) => group.items.map((item) => item.url)), SOURCE_CODE_URL];

describe('reference content of the resources page', () => {
  it('has 16 links in 4 groups and 6 prompts, with no address used two times', () => {
    const urls = RESOURCE_GROUPS.flatMap((group) => group.items.map((item) => item.url));
    expect(RESOURCE_GROUPS).toHaveLength(4);
    expect(urls).toHaveLength(16);
    expect(new Set(urls).size).toBe(16);
    expect(AI_PROMPTS).toHaveLength(6);
    expect(new Set(AI_PROMPTS.map((prompt) => prompt.title)).size).toBe(6);
  });

  it('uses only https addresses with a host and no user name', () => {
    for (const address of allUrls()) {
      const url = new URL(address);
      expect(url.protocol, address).toBe('https:');
      expect(url.hostname, address).toMatch(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/);
      expect(url.username + url.password, address).toBe('');
      // The address is in its normal form, so the link goes to the text that the file shows.
      expect(url.href, address).toBe(address);
    }
  });

  it('is the content that the script read from the record of the old build', () => {
    const digest = createHash('sha256').update(JSON.stringify(canonicalContent()), 'utf8').digest('hex');
    expect(digest).toBe(SOURCE_DIGEST);
    expect(SOURCE_DIGEST).toBe('0202301da6634583cfcb5f22164b6442e8142ed59f908b59fa9b875423a591a3');
  });

  // The record of the old build is not in the repository. To compare with it
  // directly, give its path: SNJ_OLD_CONTENT_JSON=<content-verbatim.json> npx vitest run services/sharePage.test.ts
  const sourcePath = process.env.SNJ_OLD_CONTENT_JSON ?? '';
  describe.skipIf(!sourcePath || !existsSync(sourcePath))('compared with the source file', () => {
    interface Source {
      resources_page: { resource_groups: { heading: string; items: { name: string; url: string; note: string }[] }[]; ai_prompts: unknown[] };
      share_page: { blocks: { text?: string; links?: { href: string }[] }[]; strings_outside_markup: string[] };
      registry: { tools: { id: string; useFor: string }[] };
    }
    const source = (): Source => JSON.parse(readFileSync(sourcePath, 'utf8')) as Source;

    it('has each link address, name, and note exactly as the source', () => {
      const content = canonicalContent();
      expect(content.groups).toEqual(source().resources_page.resource_groups);
      expect(content.groups.flatMap((group) => group.items.map((item) => item.url))).toEqual(
        source().resources_page.resource_groups.flatMap((group) => group.items.map((item) => item.url)),
      );
    });

    it('has each prompt exactly as the source', () => {
      expect(canonicalContent().prompts).toEqual(source().resources_page.ai_prompts);
    });

    it('has the address of the code exactly as the source', () => {
      const links = source().share_page.blocks.flatMap((block) => block.links ?? []);
      expect(links.map((link) => link.href)).toEqual([SOURCE_CODE_URL]);
    });

    it('keeps the English wording of the share text and of the flyer, except for "USB"', () => {
      expect(source().share_page.strings_outside_markup).toContain(en['sharePage.message'].replace('{address}', '${a}'));
      const uses = Object.fromEntries(source().registry.tools.map((tool) => [tool.id, tool.useFor]));
      for (const tool of flyerTools()) {
        // The old page made the full text lower case. The new text keeps "USB".
        expect(en[tool.use as keyof typeof en].toLowerCase()).toBe(`${uses[tool.id].toLowerCase()}.`);
      }
    });
  });

  it('has an English heading in the locale file that is the heading of the source', () => {
    for (const group of RESOURCE_GROUPS) {
      expect(en[`resources.group.${group.id}`]).toBe(group.heading);
    }
  });
});

describe('address of this copy', () => {
  it('joins the origin and the path', () => {
    expect(appAddress(new URL('https://toolkit.example.org/'))).toBe('https://toolkit.example.org/');
    expect(appAddress(new URL('https://example.org/toolkit/index.html'))).toBe('https://example.org/toolkit/index.html');
    expect(appAddress(new URL('http://localhost:3000/'))).toBe('http://localhost:3000/');
  });

  it('leaves out the part after "#", so a locked message or an invite in the address is not shared', () => {
    expect(appAddress(new URL('https://example.org/toolkit/?source=x#/secure-share/LOCKEDTEXT'))).toBe('https://example.org/toolkit/');
  });

  it('gives no address for a copy that is open from a file', () => {
    // The old page printed "null/home/…" on the flyer in this case.
    const location = new URL('file:///home/ana/toolkit/index.html');
    expect(location.origin).toBe('null');
    expect(appAddress(location)).toBeNull();
  });
});

describe('share text', () => {
  it('ends with the address, in each language', () => {
    const address = 'https://toolkit.example.org/';
    expect(shareMessage(tEn, address)).toBe(`Free tools to keep your community safe and informed, no account needed: ${address}`);
    expect(shareMessage(tEs, address).endsWith(`: ${address}`)).toBe(true);
    expect(shareMessage(tEs, address)).not.toBe(shareMessage(tEn, address));
  });
});

describe('flyer', () => {
  it('lists the four tools in the sequence of the registry', () => {
    expect(flyerTools().map((tool) => tool.id)).toEqual(['secure-share', 'rights-card', 'family-plan', 'resource-sheet']);
    const reversed = [...TOOLS].reverse();
    expect(flyerTools(reversed).map((tool) => tool.id)).toEqual(['resource-sheet', 'family-plan', 'rights-card', 'secure-share']);
  });

  it('uses the title of each tool from the registry', () => {
    for (const tool of flyerTools()) {
      expect(tool.title).toBe(TOOLS.find((entry) => entry.id === tool.id)?.title);
    }
  });

  it('keeps "USB" in capital letters', () => {
    // The old page wrote "usb drive", because it made the full text lower case.
    expect(tEn('sharePage.flyerUse.message')).toBe('send something sensitive over email, text, or a USB drive.');
    expect(tEs('sharePage.flyerUse.message')).toContain('USB');
  });
});

describe('text with code and a link', () => {
  it('splits a message at the marks', () => {
    expect(parseRich('Run `npm install` and then `npm run build`.')).toEqual([
      { kind: 'text', text: 'Run ' },
      { kind: 'code', text: 'npm install' },
      { kind: 'text', text: ' and then ' },
      { kind: 'code', text: 'npm run build' },
      { kind: 'text', text: '.' },
    ]);
    expect(parseRich('Fork or download [the code on GitHub].')).toEqual([
      { kind: 'text', text: 'Fork or download ' },
      { kind: 'link', text: 'the code on GitHub' },
      { kind: 'text', text: '.' },
    ]);
  });

  it('keeps a mark with no partner as plain text', () => {
    expect(parseRich('A ` alone and a [ alone')).toEqual([{ kind: 'text', text: 'A ` alone and a [ alone' }]);
    expect(parseRich('')).toEqual([]);
  });
});

describe('"Host your own copy" is true for this code', () => {
  const STEPS: MessageKey[] = [
    'sharePage.host.code',
    'sharePage.host.build',
    'sharePage.host.serve',
    'sharePage.host.origin',
    'sharePage.host.signaling',
    'sharePage.host.default',
    'sharePage.hostDocs',
  ];
  const codeParts = (t: typeof tEn) => STEPS.flatMap((key) => parseRich(t(key))).filter((part) => part.kind === 'code').map((part) => part.text);
  const read = (path: string) => readFileSync(repoFile(path), 'utf8');

  it('names only npm scripts that package.json has', () => {
    const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts;
    const named = codeParts(tEn).filter((code) => code.startsWith('npm run ')).map((code) => code.slice('npm run '.length));
    expect(named.sort()).toEqual(['build', 'signaling']);
    for (const script of named) expect(scripts[script], script).toBeTruthy();
    expect(scripts.build).toBe('vite build');
    expect(scripts.signaling).toBe('y-webrtc-signaling');
  });

  it('names the build setting that the code reads for the default signaling servers', () => {
    const setting = codeParts(tEn).find((code) => code.startsWith('VITE_'));
    expect(setting).toBe('VITE_SIGNALING_URLS=wss://your-server');
    expect(read('services/config.ts')).toContain('env.VITE_SIGNALING_URLS');
    expect(read('.env.example')).toContain('VITE_SIGNALING_URLS=wss://');
    expect(read('.env.example')).toContain('.env.local');
  });

  it('names the port of the signaling server and the Node.js version that the docs give', () => {
    expect(tEn('sharePage.host.signaling')).toContain('port 4444');
    expect(read('docs/signaling.md')).toContain('The server listens on port 4444.');
    expect(tEn('sharePage.host.build')).toContain('Node.js 22');
    expect(read('README.md')).toContain('Prerequisite: Node.js 22.');
  });

  it('names only files that are in the code', () => {
    const files = codeParts(tEn).filter((code) => /\.md$/.test(code));
    expect(files.sort()).toEqual(['README.md', 'docs/security.md', 'docs/signaling.md']);
    for (const file of files) expect(existsSync(repoFile(file)), file).toBe(true);
  });

  it('tells the host to use HTTPS and an origin that serves nothing else', () => {
    expect(tEn('sharePage.host.serve')).toContain('over HTTPS');
    expect(tEn('sharePage.host.origin')).toContain('serves nothing else');
    expect(read('docs/security.md')).toContain('Host the app on an origin that serves nothing else');
  });

  it('has the same code and the same link mark in Spanish', () => {
    expect(codeParts(tEs)).toEqual(codeParts(tEn));
    for (const key of STEPS) {
      const links = (t: typeof tEn) => parseRich(t(key)).filter((part) => part.kind === 'link').length;
      expect(links(tEs), key).toBe(links(tEn));
    }
    expect(parseRich(tEn('sharePage.host.code')).filter((part) => part.kind === 'link')).toHaveLength(1);
  });
});

describe('copy to the clipboard', () => {
  it('writes the text and reports success', async () => {
    const written: string[] = [];
    const clipboard = { writeText: async (text: string) => void written.push(text) };
    expect(await copyText('hello', clipboard)).toBe(true);
    expect(written).toEqual(['hello']);
  });

  it('reports a failure when the browser refuses the copy', async () => {
    const clipboard = { writeText: () => Promise.reject(new Error('denied')) };
    expect(await copyText('hello', clipboard)).toBe(false);
  });

  it('reports a failure when the page has no clipboard', async () => {
    // A page that is not from HTTPS or localhost has no clipboard.
    expect(await copyText('hello', undefined)).toBe(false);
  });
});
