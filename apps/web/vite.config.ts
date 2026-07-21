import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // dev 下 socket.io 直连本地 server
      '/socket.io': { target: 'http://localhost:3001', ws: true },
    },
  },
});
