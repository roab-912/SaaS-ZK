import { test, expect } from 'vitest';
import { summarize, benchmarkMarkdown } from '../../scripts/vat-demo-report.mjs';
test('summary uses actual sample values, preserves extremes and refuses missing measurements', () => {
  expect(summarize([9, 1, 3])).toEqual({ samples: 3, min: 1, median: 3, max: 9 });
  expect(summarize([1, 9])).toMatchObject({ median: 5 });
  expect(() => summarize([])).toThrow();
  expect(() => summarize([NaN])).toThrow();
});
test('report keeps failed or partial runs explicit and describes the measured boundary', () => {
  const text = benchmarkMarkdown({
    startedAt: '2026-11-02T10:00:00Z',
    environment: { cpu: 'fixture' },
    runs: [],
    checks: [],
    status: 'failed',
    failure: 'capacité indisponible',
  });
  expect(text).toContain('État : failed');
  expect(text).toContain('capacité indisponible');
  expect(text).toContain('compilation publique HTTP');
  expect(text).toContain('mémoire maximale');
});
