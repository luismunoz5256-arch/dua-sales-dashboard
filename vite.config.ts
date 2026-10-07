import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'badge-96.png'],
      manifest: {
        name: 'Dua Sales — Dua Food',
        short_name: 'Dua Sales',
        description: 'Daily visits, follow-ups, upsells and leads',
        theme_color: '#15803d',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '/',
        id: '/',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Long-press the home-screen icon for these.
        shortcuts: [
          { name: 'Today', url: '/', icons: [{ src: 'icon-192.png', sizes: '192x192' }] },
          { name: 'Follow-ups', url: '/followups', icons: [{ src: 'icon-192.png', sizes: '192x192' }] },
          { name: 'Find prospects', url: '/find', icons: [{ src: 'icon-192.png', sizes: '192x192' }] },
          { name: 'Leads', url: '/leads', icons: [{ src: 'icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        // Push notification handlers live in public/push-sw.js.
        importScripts: ['push-sw.js'],
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
})
