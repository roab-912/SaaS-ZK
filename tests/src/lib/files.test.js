// @vitest-environment jsdom
import { test, expect, vi } from 'vitest';
import { download } from '../../../src/lib/files.js';
test('download creates a JSON attachment and releases its object URL', () => {
  vi.useFakeTimers();
  const create = vi.fn(() => 'blob:proof'),
    revoke = vi.fn();
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
    expect(this.download).toBe('proof.clair');
  });
  download({ proof: 'public' }, 'proof.clair');
  expect(click).toHaveBeenCalledOnce();
  expect(create.mock.calls[0][0].type).toBe('application/json');
  vi.runAllTimers();
  expect(revoke).toHaveBeenCalledWith('blob:proof');
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
