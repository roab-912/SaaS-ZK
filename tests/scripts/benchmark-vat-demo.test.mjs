import { test, expect } from 'vitest';
import { benchmarkOptions } from '../../scripts/benchmark-vat-demo.mjs';
test('benchmarks accept only explicitly bounded runs and supported invoice counts', () => {
  expect(benchmarkOptions([])).toEqual({ repetitions: 3, counts: [10, 100, 500] });
  expect(benchmarkOptions(['--runs=1', '--counts=10'])).toEqual({ repetitions: 1, counts: [10] });
  for (const args of [
    ['--runs=0'],
    ['--runs=99'],
    ['--counts=5000'],
    ['--counts=10,10'],
    ['--whatever'],
  ])
    expect(() => benchmarkOptions(args)).toThrow();
});
