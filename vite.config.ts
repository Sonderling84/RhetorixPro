import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: './',
    server: {
      port: 3847,
      host: '127.0.0.1',
    },
    plugins: [react()],
    // API-Keys werden zur Laufzeit vom Server geholt (nicht ins Bundle baken)
    define: {},
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          // Stabile Vendor-Chunks → besseres Caching zwischen Deploys.
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          },
        },
      },
    },
    css: {
      postcss: './postcss.config.js',
    },
  };
});
