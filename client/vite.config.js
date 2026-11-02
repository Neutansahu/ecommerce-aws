import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // for local testing: forwards /api to your ALB
      '/api': { target: 'http://shop-alb-223893789.ap-south-1.elb.amazonaws.com', changeOrigin: true },
    },
  },
});