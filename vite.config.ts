import inertia from '@inertiajs/vite';
import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
    build: {
        // A new container release must not retain hashed assets from an older build.
        // A stale manifest or reused build directory can break the Inertia login bootstrap.
        emptyOutDir: true,
    },
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            refresh: true,
            // Font fallback is already defined in app.css. Do not fetch
            // remote Bunny Fonts at build time: CI and production Docker builds
            // must be reproducible even when the provider is unreachable.
        }),
        inertia(),
        react({
            babel: {
                plugins: ['babel-plugin-react-compiler'],
            },
        }),
        tailwindcss(),
        ...(mode === 'review' ? [] : [wayfinder({ formVariants: true })]),
    ],
}));
