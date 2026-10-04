import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base path matches the GitHub Pages project-site URL (https://<user>.github.io/katamino/).
// Override with the VITE_BASE env var if the repository is ever renamed/forked.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/katamino/',
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
});
