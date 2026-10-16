import config from './playwright.config.mjs';
export default {
  ...config,
  webServer: { ...config.webServer, command: 'node server/index.mjs --built' },
};
