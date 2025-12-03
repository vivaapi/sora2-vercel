import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/sora': {
        target: 'https://www.vivaapi.cn',
        changeOrigin: true,
        secure: false,
      },
      '/v1': {
        target: 'https://www.vivaapi.cn',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    outDir: 'dist',
  }
});