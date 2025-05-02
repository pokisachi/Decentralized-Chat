// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // ánh xạ '@' -> 'src' mà không cần __dirname
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      
    },
  },
  optimizeDeps: {
    include: [
      'libp2p',
      '@libp2p/websockets',
      '@libp2p/webtransport',
      '@libp2p/tcp',
      '@libp2p/mplex',
      '@chainsafe/libp2p-noise',
      '@libp2p/gossipsub',
      'uint8arrays'
    ]
  },
});
