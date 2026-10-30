import { test, expect, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'fflate';
import { loadUblJson } from '../../../src/lib/ubl-validation.js';
import { realUblValidator, Parser, ublFiles } from '../../helpers/ubl.mjs';
import { parseUblXml, decodeUbl } from '../../../shared/ubl.mjs';
test(
  'official XSD, CEN and Peppol rules run locally and reject structural and business-rule errors',
  { timeout: 30000 },
  async () => {
    const v = realUblValidator();
    try {
      for (const peppol of [false, true])
        for (const f of ublFiles(2, peppol)) {
          const xml = decodeUbl(f.bytes);
          expect((await v.validate(xml, parseUblXml(xml, Parser))).warnings).toEqual([]);
        }
      const xml = decodeUbl(ublFiles()[0].bytes);
      const externalSchema = xml.replace(
        '<Invoice ',
        '<Invoice xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2 https://untrusted.invalid/trap.xsd" ',
      );
      await expect(
        v.validate(externalSchema, parseUblXml(externalSchema, Parser)),
      ).resolves.toMatchObject({ validation: { ubl: '2.1' } });
      const malformed = xml.replace('<cbc:BuyerReference>', '<cbc:Unknown>');
      await expect(v.validate(malformed, { kind: 'invoice', profile: 'en16931' })).rejects.toThrow(
        /XSD/,
      );
      const note = xml.match(/<cbc:Note>[^<]*<\/cbc:Note>/)[0];
      const misplacedNote = xml
        .replace(note, '')
        .replace('</cbc:DocumentCurrencyCode>', '</cbc:DocumentCurrencyCode>' + note);
      await expect(v.validate(misplacedNote, parseUblXml(misplacedNote, Parser))).rejects.toThrow(
        /Note.*avant DocumentCurrencyCode/,
      );
      const wrongTotal = xml.replace(/(<cbc:PayableAmount[^>]*>)[^<]+/, (_, p) => p + '0.01');
      await expect(v.validate(wrongTotal, parseUblXml(wrongTotal, Parser))).rejects.toThrow(/BR-/);
      const peppolXml = decodeUbl(ublFiles(2, true)[0].bytes).replace(
        /<cbc:BuyerReference>.*?<\/cbc:BuyerReference>/,
        '',
      );
      await expect(v.validate(peppolXml, parseUblXml(peppolXml, Parser))).rejects.toThrow(
        /PEPPOL-EN16931-R003/,
      );
    } finally {
      await v.dispose();
    }
  },
);

test('a malformed or unexpected validation report cannot mark an invoice as valid', async () => {
  const xml = decodeUbl(ublFiles()[0].bytes);
  for (const principalResult of ['<unexpected/>', '<broken', '']) {
    const v = realUblValidator({
      loadSaxon: async () => ({ transform: () => ({ principalResult }) }),
    });
    try {
      await expect(v.validate(xml, parseUblXml(xml, Parser))).rejects.toThrow(
        /Rapport de validation/,
      );
    } finally {
      await v.dispose();
    }
  }
});

test.each(['raw-gzip', 'http-decoded-gzip', 'plain-json'])(
  'validation assets load with %s, including the full EN16931 rules over 6 MB',
  async (transport) => {
    const compressed = await readFile('public/ubl/en16931-ubl-1.3.17.sef.json.gz');
    const decoded = gunzipSync(compressed);
    expect(decoded.length).toBeGreaterThan(6000000);
    const body = transport === 'raw-gzip' ? compressed : decoded;
    const headers = transport === 'http-decoded-gzip' ? { 'Content-Encoding': 'gzip' } : {};
    const fetcher = vi.fn(async () => new Response(body, { headers }));
    vi.stubGlobal('fetch', fetcher);
    try {
      expect((await loadUblJson('en16931-ubl-1.3.17.sef.json.gz')).N).toBe('package');
      expect(fetcher).toHaveBeenCalledWith('/ubl/en16931-ubl-1.3.17.sef.json.gz');
    } finally {
      vi.unstubAllGlobals();
    }
  },
);
test('missing, invalid and oversized UBL resources fail with explicit diagnostics', async () => {
  vi.stubGlobal('fetch', vi.fn());
  try {
    fetch.mockResolvedValueOnce(new Response('missing', { status: 404 }));
    await expect(loadUblJson('missing.json.gz')).rejects.toThrow(/indisponibles/);
    for (const body of ['<html>SPA fallback</html>', new Uint8Array([0x1f, 0x8b, 0x08])]) {
      fetch.mockResolvedValueOnce(new Response(body));
      await expect(loadUblJson('invalid.json.gz')).rejects.toThrow(
        /UBL illisible.*invalid.json.gz/,
      );
    }
    fetch.mockResolvedValueOnce(new Response(new Uint8Array(12000001)));
    await expect(loadUblJson('oversized.json.gz')).rejects.toThrow(/volumineuse/);
  } finally {
    vi.unstubAllGlobals();
  }
});
