import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';

function privacyAndOffline(offline: boolean): Plugin {
  return {
    name: 'datasieve-private-build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = bundle['index.html'];
      if (!html || html.type !== 'asset') throw new Error('Missing application HTML');
      let content = String(html.source);
      const hashes: string[] = [];
      if (offline) {
        const scripts: string[] = [];
        content = content.replace(
          /<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g,
          (_tag, path: string) => {
            const file = bundle[path.replace(/^\.\//, '')];
            if (!file || file.type !== 'chunk') throw new Error(`Missing script: ${path}`);
            const code = file.code.replace(/<\/script/gi, '<\\/script');
            hashes.push(`'sha256-${createHash('sha256').update(code).digest('base64')}'`);
            scripts.push(`<script>${code}</script>`);
            return '';
          },
        );
        // Classic inline scripts must run after React's mount element exists.
        // A callback preserves literal $&, $', and $` sequences in the bundled JavaScript.
        content = content.replace('</body>', () => `${scripts.join('')}\n</body>`);
        content = content.replace(
          /<link\b[^>]*href="([^"]+\.css)"[^>]*>/g,
          (_tag, path: string) => {
            const file = bundle[path.replace(/^\.\//, '')];
            if (!file || file.type !== 'asset') throw new Error(`Missing styles: ${path}`);
            return `<style>${String(file.source)}</style>`;
          },
        );
        for (const key of Object.keys(bundle)) if (key !== 'index.html') delete bundle[key];
        html.fileName = 'DataSieve.html';
      }
      const policy = `default-src 'none'; script-src ${offline ? hashes.join(' ') : "'self'"}; style-src 'unsafe-inline'${offline ? '' : " 'self'"}; img-src 'self' data: blob:; font-src 'none'; connect-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
      html.source = content.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" /><meta http-equiv="Content-Security-Policy" content="${policy}" />`,
      );
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), privacyAndOffline(mode === 'offline')],
  build: {
    outDir: mode === 'offline' ? 'offline' : 'dist',
    modulePreload: false,
    assetsInlineLimit: Infinity,
    cssCodeSplit: false,
    sourcemap: false,
    // Single-file parity is intentional: Plotly Cartesian is bundled, never fetched.
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        ...(mode === 'offline' ? { format: 'iife' as const } : {}),
      },
    },
  },
}));
