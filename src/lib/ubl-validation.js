import { gunzipSync } from 'fflate';
import { UBL_PEPPOL, UBL_NS } from '../../shared/ubl.mjs';
export const UBL_VALIDATION = Object.freeze({ ubl: '2.1', en16931: '1.3.17', peppol: '3.0.21' });
export async function loadUblJson(name) {
  const response = await fetch('/ubl/' + name);
  if (!response.ok) throw Error('Ressources de validation UBL indisponibles.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  // Fetch already decodes Content-Encoding: gzip. Static servers can also send
  // the same .gz file as raw bytes; inspect the body to avoid decoding twice.
  const compressed = bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (bytes.length > (compressed ? 6000000 : 12000000))
    throw Error('Ressource de validation trop volumineuse.');
  let decoded;
  try {
    decoded = compressed ? gunzipSync(bytes) : bytes;
  } catch (cause) {
    throw Error('Ressource de validation UBL illisible : ' + name + '.', { cause });
  }
  if (decoded.length > 12000000) throw Error('Ressource de validation trop volumineuse.');
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decoded));
  } catch (cause) {
    throw Error('Ressource de validation UBL illisible : ' + name + '.', { cause });
  }
}
let saxonPromise;
function browserSaxon() {
  if (globalThis.SaxonJS) return Promise.resolve(globalThis.SaxonJS);
  return (saxonPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/ubl/SaxonJS2.rt.js';
    script.async = true;
    script.onload = () =>
      globalThis.SaxonJS ? resolve(globalThis.SaxonJS) : reject(Error('Moteur XSLT indisponible.'));
    script.onerror = () => {
      script.remove();
      reject(Error('Moteur XSLT indisponible.'));
    };
    document.head.append(script);
  }).catch((e) => {
    saxonPromise = undefined;
    throw e;
  }));
}
export function createUblValidator({
  loadXml = () => import('libxml2-wasm'),
  loadSaxon = browserSaxon,
  loadJson = loadUblJson,
  Parser = globalThis.DOMParser,
} = {}) {
  let resources;
  async function initialize() {
    return (resources ??= (async () => {
      const [xml, saxon, schemas, en, peppol] = await Promise.all([
        loadXml(),
        loadSaxon(),
        loadJson('schemas-2.1.json.gz'),
        loadJson('en16931-ubl-1.3.17.sef.json.gz'),
        loadJson('peppol-3.0.21.sef.json.gz'),
      ]);
      const buffers = new xml.XmlBufferInputProvider(
        Object.fromEntries(
          Object.entries(schemas).map(([name, text]) => [
            '/ubl/xsd/' + name,
            new TextEncoder().encode(text),
          ]),
        ),
      );
      xml.xmlRegisterInputProvider({
        match: () => true,
        open: (name) => buffers.open(name.replaceAll('\\', '/').replace(/^file:\/*/, '/')),
        read: (fd, bytes) => buffers.read(fd, bytes),
        close: (fd) => buffers.close(fd),
      });
      const validators = {};
      for (const [kind, name] of [
        ['invoice', 'Invoice'],
        ['credit', 'CreditNote'],
      ]) {
        const key = 'maindoc/UBL-' + name + '-2.1.xsd';
        const doc = xml.XmlDocument.fromString(schemas[key], {
          url: '/ubl/xsd/' + key,
          option: xml.ParseOption.XML_PARSE_NONET | xml.ParseOption.XML_PARSE_NO_XXE,
        });
        validators[kind] = { doc, validator: xml.XsdValidator.fromDoc(doc) };
      }
      return { xml, saxon, en, peppol, validators };
    })().catch((e) => {
      resources = undefined;
      throw e;
    }));
  }
  return {
    async validate(xmlText, parsed) {
      const r = await initialize();
      let doc;
      try {
        doc = r.xml.XmlDocument.fromString(xmlText, {
          option: r.xml.ParseOption.XML_PARSE_NONET | r.xml.ParseOption.XML_PARSE_NO_XXE,
        });
        r.validators[parsed.kind].validator.validate(doc);
      } catch (e) {
        const rootChildren = Array.from(parsed.doc?.documentElement?.children ?? []);
        const noteIndex = rootChildren.findIndex(
          (n) => n.namespaceURI === UBL_NS.cbc && n.localName === 'Note',
        );
        const currencyIndex = rootChildren.findIndex(
          (n) => n.namespaceURI === UBL_NS.cbc && n.localName === 'DocumentCurrencyCode',
        );
        if (
          currencyIndex >= 0 &&
          noteIndex > currencyIndex &&
          e.details?.[0]?.message?.includes('}Note')
        )
          throw Error(
            'XSD UBL 2.1 : la balise Note est mal placée. Elle doit apparaître avant DocumentCurrencyCode. Faites corriger le fichier par son émetteur ; les montants n’ont pas été modifiés.',
            { cause: e },
          );
        throw Error(
          'XSD UBL 2.1 : ' +
            (e.details?.[0]?.message ?? 'structure du document invalide.').slice(0, 260),
          { cause: e },
        );
      } finally {
        doc?.dispose();
      }
      const diagnostics = [];
      for (const stylesheet of [r.en, ...(parsed.profile === 'peppol-bis3' ? [r.peppol] : [])]) {
        const result = r.saxon.transform(
          { stylesheetInternal: stylesheet, sourceText: xmlText, destination: 'serialized' },
          'sync',
        ).principalResult;
        const svrl = new Parser().parseFromString(result, 'application/xml');
        if (
          svrl.documentElement?.localName !== 'schematron-output' ||
          svrl.documentElement?.namespaceURI !== 'http://purl.oclc.org/dsdl/svrl' ||
          svrl.getElementsByTagNameNS('*', 'parsererror').length
        )
          throw Error('Rapport de validation UBL invalide.');

        for (const node of svrl.getElementsByTagNameNS(
          'http://purl.oclc.org/dsdl/svrl',
          'failed-assert',
        )) {
          const text =
            node
              .getElementsByTagNameNS('http://purl.oclc.org/dsdl/svrl', 'text')[0]
              ?.textContent.trim() ?? 'Règle non respectée.';
          diagnostics.push({
            id: node.getAttribute('id') ?? 'UBL',
            severity: node.getAttribute('flag') === 'warning' ? 'warning' : 'error',
            text: text.slice(0, 500),
          });
        }
      }
      const errors = diagnostics.filter((d) => d.severity === 'error');
      if (errors.length)
        throw Error(
          'Validation ' +
            (parsed.profile === 'peppol-bis3' ? 'EN16931 / Peppol' : 'EN16931') +
            ' : ' +
            errors
              .slice(0, 5)
              .map((d) => '[' + d.id + '] ' + d.text)
              .join(' '),
        );
      return {
        validation: UBL_VALIDATION,
        profile: parsed.profile,
        warnings: diagnostics.filter((d) => d.severity === 'warning'),
      };
    },
    async dispose() {
      if (!resources) return;
      const r = await resources;
      for (const v of Object.values(r.validators)) {
        v.validator.dispose();
        v.doc.dispose();
      }
      r.xml.xmlCleanupInputProvider();
      resources = undefined;
    },
  };
}
export const ublValidator = createUblValidator();
export const isPeppolCustomization = (value) => value === UBL_PEPPOL;
