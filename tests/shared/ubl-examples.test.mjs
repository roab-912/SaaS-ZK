import { test, expect } from 'vitest';
import { makeUblExamples } from '../../shared/ubl-examples.mjs';
import { parseUblXml, decodeUbl } from '../../shared/ubl.mjs';
import { Parser } from '../helpers/ubl.mjs';
test('demo exports 500 real XML documents including invoices and credit notes', () => {
  const files = makeUblExamples({ count: 500 });
  expect(files).toHaveLength(500);
  expect(new Set(files.map((f) => f.name)).size).toBe(500);
  expect(parseUblXml(decodeUbl(files[0].bytes), Parser).kind).toBe('invoice');
  expect(parseUblXml(decodeUbl(files[499].bytes), Parser).kind).toBe('credit');
  expect(() => makeUblExamples({ count: 501 })).toThrow();
});
