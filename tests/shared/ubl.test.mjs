import { test, expect } from 'vitest';
import { Parser, ublFiles } from '../helpers/ubl.mjs';
import { decodeUbl, parseUblXml, normalizeUbl, ublDraft, ublCents } from '../../shared/ubl.mjs';
test('UBL namespaces, credit references and exact decimal amounts map to the existing VAT contract', async () => {
  const files = ublFiles(),
    records = [];
  for (const f of files) records.push(await normalizeUbl(parseUblXml(decodeUbl(f.bytes), Parser)));
  expect(records[1].invoice.reference).toBe(records[0].invoice.id);
  expect(ublDraft(records, '2026-09-01', '2026-09-30').companyId).toBe('FR00000000000');
  expect(records[0].invoice.lines[0]).toEqual({ rateBps: 550, netCents: 2500, vatCents: 138 });
  expect(ublCents('0.01')).toBe(1);
  expect(ublCents('1000000.00')).toBe(100000000);
  expect(() => ublCents('1.001')).toThrow();
  expect(() => ublCents('-1')).toThrow();
  const prefixed = decodeUbl(files[0].bytes)
    .replace('<Invoice xmlns=', '<u:Invoice xmlns:u=')
    .replace('</Invoice>', '</u:Invoice>');
  expect(parseUblXml(prefixed, Parser).kind).toBe('invoice');
});
test('untrusted XML, wrong profiles and unsupported fiscal cases fail explicitly', async () => {
  const xml = decodeUbl(ublFiles()[0].bytes);
  for (const value of [
    '<!DOCTYPE x [<!ENTITY leak SYSTEM "file:///secret">]>' + xml,
    xml.replace('<Invoice ', '<Invoice evil="x" ').replace('</Invoice>', ''),
    xml.replace('schema:xsd:Invoice-2', 'schema:xsd:Fake-2'),
    xml.replace('urn:cen.eu:en16931:2017', 'urn:unsupported'),
  ])
    expect(() => parseUblXml(value, Parser)).toThrow();
  for (const value of [
    xml.replace('>EUR<', '>USD<'),
    xml.replace('>380<', '>386<'),
    xml.replace('<cbc:ID>S</cbc:ID>', '<cbc:ID>O</cbc:ID>'),
  ])
    await expect(normalizeUbl(parseUblXml(value, Parser))).rejects.toThrow();
  const a = await normalizeUbl(parseUblXml(xml, Parser));
  expect(() => ublDraft([a, a], '2026-09-01', '2026-09-30')).toThrow(/plusieurs fois/);
  expect(() => ublDraft([a], '2026-10-01', '2026-10-31')).toThrow(/hors période/);
  expect(() => ublDraft([a, { ...a, companyId: 'OTHER' }], '2026-09-01', '2026-09-30')).toThrow(
    /même fournisseur/,
  );
});

test('XML complexity is bounded before allocating a DOM and UTF-8 is enforced', () => {
  let allocated = false;
  class ForbiddenParser {
    constructor() {
      allocated = true;
      throw Error('DOM must not be built');
    }
  }
  const deep = '<x>'.repeat(65) + '</x>'.repeat(65);
  const wide = '<x>' + '<n/>'.repeat(20000) + '</x>';
  for (const xml of [deep, wide])
    expect(() => parseUblXml(xml, ForbiddenParser)).toThrow(/trop complexe/);
  expect(allocated).toBe(false);
  expect(() => decodeUbl(new Uint8Array([0xff, 0xfe, 0x41]))).toThrow(/UTF-8/);
  expect(() =>
    decodeUbl(new TextEncoder().encode('<?xml version="1.0" encoding="ISO-8859-1"?><x/>')),
  ).toThrow(/UTF-8/);
});

test('reverse charge or export categories cannot disguise nonzero VAT or an unsupported rate', async () => {
  const xml = decodeUbl(ublFiles(1)[0].bytes);
  for (const category of ['AE', 'G']) {
    const nonzero = xml
      .replaceAll('<cbc:ID>S</cbc:ID>', '<cbc:ID>' + category + '</cbc:ID>')
      .replaceAll('<cbc:Percent>20</cbc:Percent>', '<cbc:Percent>0</cbc:Percent>')
      .replaceAll('<cbc:Percent>5.5</cbc:Percent>', '<cbc:Percent>0</cbc:Percent>');
    await expect(normalizeUbl(parseUblXml(nonzero, Parser))).rejects.toThrow(/montant de TVA nul/);
  }
  await expect(
    normalizeUbl(
      parseUblXml(
        xml.replace('<cbc:Percent>20</cbc:Percent>', '<cbc:Percent>19</cbc:Percent>'),
        Parser,
      ),
    ),
  ).rejects.toThrow(/hors périmètre/);
});
