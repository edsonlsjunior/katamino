import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The app is served from the root (/). A deploy under a sub-path, such as a GitHub
// Pages project site, sets the VITE_BASE env var (see .github/workflows/deploy.yml).
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
});
