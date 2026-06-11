import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  base: '/InkDrop/',
  plugins: [
    svelte(),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@ffmpeg/core/dist/esm/*',
          dest: 'ffmpeg-core',
          rename: { stripBase: true },
        },
      ],
    }),
  ],
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
});
