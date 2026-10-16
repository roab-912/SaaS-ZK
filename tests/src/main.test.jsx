// @vitest-environment jsdom
import { test, expect, vi } from 'vitest';
const render = vi.hoisted(() => vi.fn());
vi.mock('react-dom/client', () => ({ createRoot: vi.fn(() => ({ render })) }));
vi.mock('../../src/App.jsx', () => ({ App: () => null }));
test('entrypoint mounts App in the documented root element', async () => {
  document.body.innerHTML = '<div id="root"></div>';
  await import('../../src/main.jsx');
  expect(render).toHaveBeenCalledOnce();
  expect(render.mock.calls[0][0].type.name).toBe('App');
});
