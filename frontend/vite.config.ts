import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

const API_TARGET = process.env['VITE_DEV_API_TARGET'] ?? 'http://localhost:3000';

export default defineConfig({
  envDir: '..',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Portal Inmobiliario',
        short_name: 'Inmobiliario',
        description: 'Búsqueda de propiedades por zona sobre mapas vectoriales',
        theme_color: '#1d4ed8',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api/, /^\/socket\.io/],
        runtimeCaching: [
          {
            // Mapa base vectorial: cache-first para que el mapa funcione sin conexión en zonas ya vistas.
            urlPattern: ({ url }) => url.hostname === 'tiles.openfreemap.org',
            handler: 'CacheFirst',
            options: { cacheName: 'basemap', expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 14 } },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/tiles/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'listing-tiles', expiration: { maxEntries: 1000, maxAgeSeconds: 60 * 60 * 24 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // MapLibre (~1 MB) vive en su propio chunk diferido: solo se descarga en las vistas con mapa.
    chunkSizeWarningLimit: 1100,
  },
  server: {
    port: 5173,
    // Mismo origen en desarrollo: la cookie SameSite=Strict del refresh token funciona sin CORS.
    proxy: {
      '/api': API_TARGET,
      '/socket.io': { target: API_TARGET, ws: true },
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/unit/**/*.test.ts'],
  },
});
