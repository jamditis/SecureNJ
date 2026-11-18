/**
 * Runs a TypeScript module of this folder in Node, through the module loader
 * of Vite, so that the module can import the app code (`services/`, `locales/`,
 * `content/`) with the same rules as the build.
 *
 *   node scripts/run.mjs <name> [arguments]
 *
 * The module `scripts/<name>.ts` must export `main(args)`, which returns the
 * exit status.
 */
import { createServer } from 'vite';

const [name, ...args] = process.argv.slice(2);
if (!name || !/^[\w-]+$/.test(name)) {
  console.error('Usage: node scripts/run.mjs <name> [arguments]');
  process.exit(2);
}

const server = await createServer({
  configFile: false,
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const module = await server.ssrLoadModule(`/scripts/${name}.ts`);
  process.exitCode = await module.main(args);
} finally {
  await server.close();
}
