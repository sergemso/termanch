import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'node:path';

// Bundles the real Connection (WebRTC and WebSocket transports) and the real AppShell + KeyRow for the
// browser end-to-end test.
export default defineConfig({
  root: __dirname,
  base: './',
  plugins: [svelte()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: { input: { index: resolve(__dirname, 'index.html'), shell: resolve(__dirname, 'shell.html'), cards: resolve(__dirname, 'cards.html'), navigation: resolve(__dirname, 'navigation.html') } },
  },
});
