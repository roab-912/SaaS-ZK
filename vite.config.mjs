import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({ include: ['buffer'], globals: { Buffer: true, global: true, process: true } }),
  ],
  worker: {
    format: 'es',
    plugins: () => [
      nodePolyfills({
        include: ['buffer'],
        globals: { Buffer: true, global: true, process: true },
      }),
    ],
  },
  optimizeDeps: {
    exclude: ['@aztec/bb.js', '@noir-lang/noir_js', '@noir-lang/acvm_js', '@noir-lang/noirc_abi'],
  },
  build: { target: 'esnext', chunkSizeWarningLimit: 1200 },
});
