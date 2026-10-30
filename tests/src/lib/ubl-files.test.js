import { test, expect, vi } from 'vitest';
import { downloadUblExamples, downloadOriginalUbl } from '../../../src/lib/ubl-files.js';
import { downloadBytes } from '../../../src/lib/files.js';
import { bytesToBase64 } from '../../../shared/vat-documents.mjs';
import { unzipSync } from 'fflate';
vi.mock('../../../src/lib/files.js', () => ({ downloadBytes: vi.fn() }));
test('XML downloads preserve original bytes and examples are delivered as a ZIP', () => {
  const bytes = new TextEncoder().encode('<?xml version="1.0"?><original/>');
  downloadOriginalUbl({ name: '../original.xml', invoiceId: 'i', content: bytesToBase64(bytes) });
  expect(downloadBytes).toHaveBeenLastCalledWith(bytes, 'original.xml', 'application/xml');
  downloadUblExamples([{ name: 'example.xml', bytes }]);
  const zipped = downloadBytes.mock.lastCall[0];
  expect(unzipSync(zipped)['001-example.xml']).toEqual(bytes);
  expect(downloadBytes.mock.lastCall[1]).toBe('Exemples.UBL.zip');
});
