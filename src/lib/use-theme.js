import { useSyncExternalStore } from 'react';
import { subscribeTheme, themeSnapshot, setThemePreference } from './theme.js';
export function useTheme() {
  const snapshot = useSyncExternalStore(subscribeTheme, themeSnapshot, () => 'system:light');
  const [preference, theme] = snapshot.split(':');
  return { preference, theme, setPreference: setThemePreference };
}
