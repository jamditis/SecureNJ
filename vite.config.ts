import { loadEnv, type HtmlTagDescriptor, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The policy blocks all third-party requests except the WebSocket connection
// to the signaling server that a group configures. It is added only to the
// production build because the Vite dev server needs inline scripts.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self' ws: wss:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

function htmlMeta(siteUrl: string): Plugin {
  // Link previews need absolute URLs. A group sets VITE_SITE_URL to the
  // address where it hosts the build.
  const base = siteUrl.replace(/\/+$/, '');
  return {
    name: 'securenj-html-meta',
    transformIndexHtml(html, ctx) {
      const tags: HtmlTagDescriptor[] = [
        { tag: 'meta', attrs: { property: 'og:image', content: base ? `${base}/og.png` : 'og.png' }, injectTo: 'head' },
      ];
      if (base) {
        tags.push({ tag: 'meta', attrs: { property: 'og:url', content: `${base}/` }, injectTo: 'head' });
      }
      if (!ctx.server) {
        tags.push({
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
          injectTo: 'head-prepend',
        });
      }
      return { html, tags };
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  return {
    // A relative base lets a group host the build in any folder.
    base: './',
    // The dev server listens on this computer only. VITE_DEV_HOST opens it to
    // the local network, for a test on a phone.
    server: { port: 3000, host: env.VITE_DEV_HOST || '127.0.0.1' },
    plugins: [react(), tailwindcss(), htmlMeta(env.VITE_SITE_URL ?? '')],
    test: {
      environment: 'node',
      include: ['services/**/*.test.{ts,tsx}', 'components/**/*.test.tsx', 'scripts/**/*.test.ts'],
      setupFiles: ['./test-setup.ts'],
      restoreMocks: true,
    },
  };
});
