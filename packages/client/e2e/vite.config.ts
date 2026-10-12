import { defineConfig } from 'vite';

// Bundles the real Connection (WebRTC and WebSocket transports) for the browser end-to-end test.
export default defineConfig({
  root: __dirname,
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
});
