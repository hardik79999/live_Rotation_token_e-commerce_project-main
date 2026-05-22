import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.VITE_API_URL || env.VITE_API_BASE_URL || 'http://localhost:7899'

  return defineConfig({
    plugins: [
      react(),
      tailwindcss(),

      VitePWA({
        // 'autoUpdate' silently updates the SW in the background.
      // The new version activates on the next page load.
      registerType: 'autoUpdate',

      // Include all assets that should be pre-cached
      includeAssets: [
        'favicon.svg',
        'logo.png',
        'logo.svg',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'pwa-maskable-512x512.png',
        'screenshot-desktop.png',
        'screenshot-mobile.png',
      ],

      // Web App Manifest
      manifest: {
        name:             'ShopHub — India\'s Fastest Growing Marketplace',
        short_name:       'ShopHub',
        description:      'Shop millions of products from verified sellers. Fast delivery, easy returns, best prices.',
        theme_color:      '#0f172a',   // slate-900 — matches dark mode
        background_color: '#0f172a',
        display:          'standalone',
        orientation:      'portrait',
        scope:            '/',
        start_url:        '/',
        lang:             'en',
        categories:       ['shopping', 'lifestyle'],
        icons: [
          {
            src:   '/pwa-192x192.png',
            sizes: '192x192',
            type:  'image/png',
            purpose: 'any',
          },
          {
            src:   '/pwa-512x512.png',
            sizes: '512x512',
            type:  'image/png',
            purpose: 'any',
          },
          {
            src:   '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type:  'image/png',
            purpose: 'maskable',   // safe-zone icon for Android adaptive icons
          },
        ],
        screenshots: [
          {
            src:         '/screenshot-desktop.png',
            sizes:       '1280x800',
            type:        'image/png',
            form_factor: 'wide',
            label:       'ShopHub — Desktop shopping experience',
          },
          {
            src:         '/screenshot-mobile.png',
            sizes:       '390x844',
            type:        'image/png',
            form_factor: 'narrow',
            label:       'ShopHub — Mobile shopping experience',
          },
        ],
      },

      // Workbox service worker configuration
      workbox: {
        // Cache strategy: StaleWhileRevalidate for HTML, CacheFirst for assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],

        // Runtime caching rules
        runtimeCaching: [
          // ── API calls: NetworkFirst (fresh data when online, cached when offline) ──
          {
            urlPattern: /^https?:\/\/.*\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName:          'api-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries:    50,
                maxAgeSeconds: 5 * 60,   // 5 minutes
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // ── Product images & uploads: CacheFirst (images rarely change) ──
          {
            urlPattern: /^https?:\/\/.*\/static\/uploads\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'product-images',
              expiration: {
                maxEntries:    200,
                maxAgeSeconds: 7 * 24 * 60 * 60,   // 7 days
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // ── Google Fonts: CacheFirst ──
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: {
                maxEntries:    20,
                maxAgeSeconds: 365 * 24 * 60 * 60,   // 1 year
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],

        // Offline fallback — served when a navigation request fails
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/static\//],
      },

      // Dev mode: enable SW in development so you can test it
      devOptions: {
        enabled: false,   // set true to test SW locally
        type:    'module',
      },
    }),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  build: {
    outDir:     'dist',
    emptyOutDir: true,
  },

  server: {
    host: '0.0.0.0',  // Accept connections from any device on the network
    port: 5173,
    allowedHosts: ['.ngrok-free.dev', '.ngrok.io'],
    proxy: {
      '/api': {
        target:       backendUrl,
        changeOrigin: true,
        secure:       false,
      },
      '/static': {
        target:       backendUrl,
        changeOrigin: true,
        secure:       false,
      },
      '/apidocs': {
        target:       backendUrl,
        changeOrigin: true,
        secure:       false,
      },
    },
  },
})
}
