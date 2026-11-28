import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
    root: fileURLToPath(new URL('./web', import.meta.url)),
    base: './',
    build: {
        outDir: fileURLToPath(new URL('./build/web', import.meta.url)),
        emptyOutDir: true,
    },
});
