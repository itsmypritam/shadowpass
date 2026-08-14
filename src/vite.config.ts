import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { zkAssetsPlugin } from './zk-assets-plugin';

// Vite config for the ShadowPass web app (project root is this `src/` folder).
// `/api` requests are proxied to the local API server (see server.ts).
// `/zk` requests are served from the compiled ZK artifacts by zkAssetsPlugin.
export default defineConfig({
  root: __dirname,
  plugins: [react(), wasm(), topLevelAwait(), zkAssetsPlugin()],
  resolve: {
    alias: {
      // isomorphic-ws only default-exports in the browser; the indexer
      // provider does a named import. Satisfy it with the native global.
      'isomorphic-ws': `${__dirname.replace(/\\/g, '/')}/vendor/isomorphic-ws.ts`,
      // cross-fetch re-exports the native window.fetch unbound, which throws
      // "Illegal invocation" when the midnight-js providers call it with a
      // different receiver. Replace it with a window-bound fetch.
      'cross-fetch': `${__dirname.replace(/\\/g, '/')}/vendor/cross-fetch.ts`,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
});
