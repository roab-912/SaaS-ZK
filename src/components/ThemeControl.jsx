import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../lib/use-theme.js';
export function ThemeControl() {
  const { preference, theme, setPreference } = useTheme();
  const Icon = theme === 'dark' ? Moon : Sun;
  return (
    <label className="theme-control">
      <Icon size={17} aria-hidden="true" />
      <span className="sr-only">Apparence</span>
      <select
        aria-label="Apparence"
        value={preference}
        onChange={(e) => setPreference(e.target.value)}
      >
        <option value="system">Appareil</option>
        <option value="light">Clair</option>
        <option value="dark">Sombre</option>
      </select>
    </label>
  );
}
