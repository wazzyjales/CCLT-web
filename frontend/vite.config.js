/**
 * Vite Configuration
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  
  server: {
    host: '0.0.0.0', // Listen on all network interfaces 
    port: 5173,       // Frontend dev server port
    
    proxy: {
      '/api': {
        target: 'http://backend:2000', // Backend service name in Docker
        changeOrigin: true,
        secure: false,
      }
    }
  },
})