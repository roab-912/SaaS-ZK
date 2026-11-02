// @vitest-environment jsdom
import { test, expect, vi, afterEach } from 'vitest';
import {
  applyTheme,
  themePreference,
  themeSnapshot,
  setThemePreference,
  subscribeTheme,
} from '../../../src/lib/theme.js';
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  setThemePreference('system');
  localStorage.clear();
});
test('the device setting, stored preference and other-tab updates keep the document synchronized', () => {
  const media = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal('matchMedia', () => media);
  localStorage.clear();
  expect(themeSnapshot()).toBe('system:dark');
  expect(applyTheme()).toBe('dark');
  const notify = vi.fn(),
    stop = subscribeTheme(notify);
  setThemePreference('light');
  expect(document.documentElement.dataset.theme).toBe('light');
  expect(document.documentElement.style.colorScheme).toBe('light');
  expect(localStorage.getItem('clair.theme')).toBe('light');
  localStorage.setItem('clair.theme', 'dark');
  window.dispatchEvent(new StorageEvent('storage', { key: 'clair.theme' }));
  expect(notify).toHaveBeenCalledTimes(2);
  expect(document.documentElement.dataset.theme).toBe('dark');
  setThemePreference('system');
  media.matches = false;
  media.addEventListener.mock.calls[0][1]();
  expect(document.documentElement.dataset.theme).toBe('light');
  stop();
  expect(media.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  const calls = notify.mock.calls.length;
  window.dispatchEvent(new Event('clair:theme'));
  expect(notify).toHaveBeenCalledTimes(calls);
});
test('blocked storage still allows appearance changes without persisting form data', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw Error('blocked');
  });
  setThemePreference('dark');
  expect(themePreference()).toBe('dark');
  expect(applyTheme()).toBe('dark');
  expect(() => setThemePreference('invalid')).toThrow(/inconnue/);
});
