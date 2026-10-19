import config from './vitest.config.mjs';
export default {
  ...config,
  test: {
    ...config.test,
    include: ['tests/offline-distribution.test.mjs'],
    exclude: [],
    testTimeout: 300000,
    coverage: { enabled: false },
  },
};
