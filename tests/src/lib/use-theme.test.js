// @vitest-environment jsdom
import { test, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../../../src/lib/use-theme.js';
test('all mounted consumers receive the same appearance change', () => {
  const a = renderHook(() => useTheme()),
    b = renderHook(() => useTheme());
  act(() => a.result.current.setPreference('dark'));
  expect(b.result.current.theme).toBe('dark');
  act(() => b.result.current.setPreference('light'));
  expect(a.result.current.preference).toBe('light');
  a.unmount();
  b.unmount();
  localStorage.clear();
});
