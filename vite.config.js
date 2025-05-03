// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
  ],
  optimizeDeps: {
    include: [
      'libp2p',
      '@libp2p/websockets',
      '@chainsafe/libp2p-noise',
      '@chainsafe/libp2p-gossipsub',
      '@libp2p/mplex',
      'uint8arrays'
    ]
  },
})


