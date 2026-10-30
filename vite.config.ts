import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const BASE = '/Light-House-Management/';

// Short sha in CI (VITE_APP_VERSION=$GITHUB_SHA), "dev" locally.
const version = (process.env.VITE_APP_VERSION ?? 'dev').slice(0, 7);
const builtAt = new Date().toISOString();

/** Emits /version.json so the deploy smoke test can prove which commit is live. */
function versionJson(): Plugin {
  return {
    name: 'light-house:version-json',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version, builtAt }) + '\n',
      });
    },
  };
}

export default defineConfig({
  base: BASE,
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILT_AT__: JSON.stringify(builtAt),
  },
  plugins: [
    react(),
    versionJson(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'offline.html'],
      manifest: {
        id: BASE,
        name: 'Light House – Mess Meal Manager',
        short_name: 'Light House',
        description: 'Meals, bazar, bills and month-end settlement for the mess.',
        lang: 'en',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#050807',
        theme_color: '#050807',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: `${BASE}index.html`,
        // version.json must always come from the network.
        navigateFallbackDenylist: [/version\.json$/],
      },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
