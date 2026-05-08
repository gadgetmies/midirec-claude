import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  /* GitHub Pages serves at https://gadgetmies.github.io/midirec-claude/, so
     production builds need their asset URLs prefixed with the repo path.
     Dev keeps `/` so vite's HMR + the dev server URL stay simple. */
  base: command === 'build' ? '/midirec-claude/' : '/',
  plugins: [react()],
}));
