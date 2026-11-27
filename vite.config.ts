import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import inertia from '@inertiajs/vite';
import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { defineConfig } from 'vite';

// MapLibre's published ESM entry is a single 1 MB file. Use its distributed
// source modules so Rolldown can split the map-only code without changing the
// application chunk-size warning threshold.
const require = createRequire(import.meta.url);
const mapLibrePackageRoot = dirname(
    dirname(require.resolve('maplibre-gl/dist/maplibre-gl.mjs')),
);
const mapLibreSourceEntry = resolve(mapLibrePackageRoot, 'src/index.ts');

export default defineConfig(({ mode }) => ({
    resolve: {
        alias: [{ find: /^maplibre-gl$/, replacement: mapLibreSourceEntry }],
    },
    build: {
        // A new container release must not retain hashed assets from an older build.
        // A stale manifest or reused build directory can break the Inertia login bootstrap.
        emptyOutDir: true,
        rolldownOptions: {
            output: {
                codeSplitting: {
                    groups: [
                        {
                            name: 'maplibre-vendor',
                            test: /node_modules[\\/](?:maplibre-gl|@maplibre)[\\/]/,
                            priority: 20,
                            minSize: 20_000,
                            maxSize: 400_000,
                        },
                    ],
                },
            },
        },
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
