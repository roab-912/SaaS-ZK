import config from './playwright.config.mjs';
export default {
  ...config,
  webServer: { ...config.webServer, command: 'node tests/helpers/browser-server.mjs --built' },
};
