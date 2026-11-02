const key = 'clair.theme';
const changeEvent = 'clair:theme';
const preferences = ['system', 'light', 'dark'];
let temporary;
export function themePreference() {
  if (temporary !== undefined) return temporary;
  try {
    const value = globalThis.localStorage?.getItem(key);
    return preferences.includes(value) ? value : 'system';
  } catch {
    return 'system';
  }
}
export function themeSnapshot() {
  const preference = themePreference();
  const dark = globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  return preference + ':' + (preference === 'system' ? (dark ? 'dark' : 'light') : preference);
}
export function applyTheme() {
  const theme = themeSnapshot().split(':')[1];
  if (globalThis.document) {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }
  return theme;
}
export function setThemePreference(value) {
  if (!preferences.includes(value)) throw Error('Apparence inconnue.');
  temporary = value;
  try {
    localStorage.setItem(key, value);
    temporary = undefined;
  } catch {}
  applyTheme();
  globalThis.window?.dispatchEvent(new Event(changeEvent));
}
export function subscribeTheme(listener) {
  const update = () => {
    applyTheme();
    listener();
  };
  const storage = (event) => {
    if (event.key === key || event.key === null) {
      temporary = undefined;
      update();
    }
  };
  const media = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
  window.addEventListener(changeEvent, update);
  window.addEventListener('storage', storage);
  media?.addEventListener?.('change', update);
  applyTheme();
  return () => {
    window.removeEventListener(changeEvent, update);
    window.removeEventListener('storage', storage);
    media?.removeEventListener?.('change', update);
  };
}
