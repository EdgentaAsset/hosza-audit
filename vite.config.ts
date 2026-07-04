import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  // Laluan relatif supaya boleh dihoskan di GitHub Pages (sub-laluan /hosza-audit/)
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        preview: resolve(__dirname, 'preview.html'),
      },
    },
  },
});
