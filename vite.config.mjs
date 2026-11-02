import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import inject from '@rollup/plugin-inject';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('.', import.meta.url)).replaceAll('\\', '/');
const globals = fileURLToPath(new URL('./src/lib/browser-globals.js', import.meta.url));
const browserGlobals = () => ({
  ...inject({
    Buffer: [globals, 'Buffer'],
    global: [globals, 'global'],
    process: [globals, 'process'],
  }),
  enforce: 'post',
});
export default defineConfig({
  plugins: [react(), browserGlobals()],
  resolve: {
    alias: [
      { find: /^buffer$/, replacement: require.resolve('buffer/') },
      { find: /^process$/, replacement: require.resolve('process/browser') },
    ],
  },
  server: {
    fs: {
      strict: true,
      allow: ['src', 'shared', 'zk', 'node_modules', 'public', 'index.html'].map((p) => root + p),
      deny: [
        '.env',
        '.env.*',
        '*.{crt,pem,key}',
        '**/.git/**',
        '**/*.clair',
        '**/*.sqlite*',
        ...['data', 'server', 'tests', 'scripts', 'docs', 'offline', 'vendor'].map(
          (p) => root + p + '/**',
        ),
      ],
    },
  },
  worker: { format: 'es', plugins: () => [browserGlobals()] },
  optimizeDeps: {
    entries: ['index.html', 'src/zk.worker.js'],
    include: ['buffer', 'process/browser'],
    exclude: ['@aztec/bb.js', '@noir-lang/noir_js', '@noir-lang/acvm_js', '@noir-lang/noirc_abi'],
    esbuildOptions: { inject: [globals] },
  },
  build: { target: 'esnext', chunkSizeWarningLimit: 1200 },
});
