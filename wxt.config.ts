import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'WaveInflu DM',
    description: 'Instagram 私信自动化工具',
    version: '1.0.0',
    permissions: [
      'storage',
      'activeTab',
      'scripting',
      'tabs'
    ],
    host_permissions: [
      'https://www.instagram.com/*'
    ]
  },
  srcDir: 'src',
  outDir: 'dist',
  vite: () => ({
    build: {
      rollupOptions: {
        output: {
          assetFileNames: 'assets/[name][extname]',
          chunkFileNames: 'chunks/[name].js',
          entryFileNames: 'chunks/[name].js',
        }
      }
    }
  }),
  alias: {
    '@': 'src',
    '@/utils': 'src/utils',
    '@/types': 'src/types',
    '@/entrypoints': 'src/entrypoints'
  }
});