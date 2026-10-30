import { test, expect } from 'vitest';
import { chromium } from '@playwright/test';
import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend } from '@aztec/bb.js';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createWriteStream } from 'node:fs';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
import { serverFixture } from './helpers/server.mjs';
import { offlineFixture } from './helpers/offline.mjs';
import { privateFixture } from './helpers/private-attestation.mjs';
import { compileCircuit } from '../server/compiler.mjs';
import { createNoirRuntime } from '../zk/noir/runtime.mjs';
import { circomBrowsers } from '../zk/circom/browser.mjs';
import { createEngineRegistry } from '../zk/registry.mjs';
import { executeZkOperation } from '../zk/operations.mjs';
import { signAttestation } from '../shared/attestations.mjs';
import { ENGINE, PLONK_ENGINE, FFLONK_ENGINE } from '../shared/engines.mjs';
test('downloaded Windows application verifies all engines, private signatures and 500 invoices without network', async () => {
  const temp = await offlineFixture(),
    online = await serverFixture();
  let child, browser;
  try {
    const f = await privateFixture();
    const { ublFixture } = await import('./helpers/ubl.mjs');
    const v = await ublFixture(500, true);
    online.db
      .prepare('INSERT INTO issuers(id,name,jwk,approved) VALUES(?,?,?,1)')
      .run('source-1', 'Source de test', JSON.stringify(f.keys.publicKey));
    online.db
      .prepare('INSERT INTO issuers(id,name,jwk,approved) VALUES(?,?,?,1)')
      .run('vat-demo', 'Autorit? TVA test', JSON.stringify(v.pub));
    const response = await online.request('/offline-verifier');
    expect(response.status).toBe(200);
    const download = join(temp.dir, 'download.zip');
    await pipeline(Readable.fromWeb(response.body), createWriteStream(download));
    const outer = join(temp.dir, 'outer'),
      app = join(outer, 'logiciel');
    await mkdir(app, { recursive: true });
    await promisify(execFile)('tar.exe', ['-x', '-f', download, '-C', outer], {
      windowsHide: true,
      timeout: 90000,
    });
    // Exercise the same extraction engine used by demarrer.cmd.
    await promisify(execFile)(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        "Expand-Archive -LiteralPath '" +
          join(outer, 'logiciel.zip').replaceAll("'", "''") +
          "' -DestinationPath '" +
          app.replaceAll("'", "''") +
          "'",
      ],
      { windowsHide: true, timeout: 120000 },
    );
    expect(JSON.parse(await readFile(join(outer, 'sources.clair'), 'utf8')).issuers).toHaveLength(
      2,
    );
    child = spawn(
      join(app, 'node.exe'),
      [
        '--import',
        './offline/network.mjs',
        './offline/server.mjs',
        '--trust',
        '../sources.clair',
        '--no-browser',
      ],
      {
        cwd: app,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          SystemRoot: process.env.SystemRoot,
          PATH: process.env.PATH,
          TEMP: temp.dir,
          TMP: temp.dir,
        },
      },
    );
    let log = '',
      errors = '';
    child.stderr.on('data', (chunk) => {
      errors += chunk;
    });
    const address = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Portable startup timeout: ' + errors)), 30000);
      child.stdout.on('data', (chunk) => {
        log += chunk;
        const m = /http:\/\/127\.0\.0\.1:\d+/.exec(log);
        if (m) {
          clearTimeout(timer);
          resolve(m[0]);
        }
      });
      child.once('exit', (code) => {
        clearTimeout(timer);
        reject(Error('Portable startup failed ' + code + ': ' + errors));
      });
    });
    const html = await (await fetch(address)).text(),
      token = /name="clair-token"\s+content="([a-f0-9]{64})"/.exec(html)[1];
    const noir = createNoirRuntime({
      Noir,
      Backend: UltraHonkBackend,
      encode: (b) => Buffer.from(b).toString('base64'),
      decode: (s) => new Uint8Array(Buffer.from(s, 'base64')),
    });
    const registry = createEngineRegistry([noir, ...circomBrowsers], ['prove', 'verify']);
    const { publicKey, signature: _signature, ...payload } = f.attestation;
    const publicAttestation = await signAttestation(
      { ...payload, format: 'clair-attestation/1' },
      f.keys.privateKey,
      publicKey,
    );
    for (const [engine, isPrivate] of [
      [ENGINE, false],
      [PLONK_ENGINE, false],
      [FFLONK_ENGINE, false],
      [ENGINE, true],
    ]) {
      const circuit = structuredClone(f.circuit);
      circuit.engine = engine;
      if (!isPrivate) {
        circuit.inputs[0].visibility = 'public';
        delete circuit.inputs[0].attestation.publicKey;
      }
      const attestations = [
        { inputId: 'income', attestation: isPrivate ? f.attestation : publicAttestation },
      ];
      const compiled = await compileCircuit(circuit);
      const envelope = await executeZkOperation(
        {
          mode: 'prove',
          circuit,
          engine,
          values: f.values,
          attestations,
          issuers: f.issuers,
          compiled,
        },
        registry,
      );
      if (!isPrivate) {
        const r = await fetch(address + '/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Clair-Local-Token': token },
          body: JSON.stringify(envelope),
        });
        const result = await r.json();
        expect(result, engine).toMatchObject({
          valid: true,
          result: true,
          sources: [{ approved: true, signatureValid: true }],
        });
      } else {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage(),
          remote = [];
        await page.route('**/*', (route) => {
          if (route.request().url().startsWith(address)) return route.continue();
          remote.push(route.request().url());
          return route.abort();
        });
        await page.goto(address);
        await page.getByLabel('Fichier de preuve .clair').setInputFiles({
          name: 'private.preuve.clair',
          mimeType: 'application/json',
          buffer: Buffer.from(JSON.stringify(envelope)),
        });
        await page.getByRole('button', { name: 'Vérifier la preuve', exact: true }).click();
        await expect
          .poll(
            () =>
              page
                .getByRole('heading', { name: 'Preuve valide selon le registre téléchargé' })
                .count(),
            { timeout: 90000 },
          )
          .toBe(1);
        expect(await page.locator('#sources').textContent()).toContain(
          'Clé présente dans le registre téléchargé',
        );
        expect(await page.locator('#values').textContent()).not.toContain(String(f.values.income));
        expect(remote).toEqual([]);
        await page.screenshot({
          path: resolve('test-results/offline-private-verified.png'),
          fullPage: true,
        });
        const bad = structuredClone(envelope);
        bad.privateAttestations[0].expiresAt = new Date(
          Date.parse(bad.privateAttestations[0].expiresAt) + 1000,
        ).toISOString();
        bad.publicInputs[3] = '0x' + Date.parse(bad.privateAttestations[0].expiresAt).toString(16);
        const tampered = await fetch(address + '/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Clair-Local-Token': token },
          body: JSON.stringify(bad),
        });
        expect((await tampered.json()).valid).toBe(false);
      }
    }

    const vatBatch = v.batch,
      compiled = await compileCircuit(v.circuit);
    const vatProof = await executeZkOperation(
      {
        mode: 'prove',
        circuit: v.circuit,
        compiled,
        values: v.values,
        vatBatch,
        issuers: v.issuers,
      },
      registry,
    );
    const vatResponse = await fetch(address + '/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Clair-Local-Token': token },
      body: JSON.stringify(vatProof),
    });
    const vatResult = await vatResponse.json();
    expect(vatResult).toMatchObject({
      valid: true,
      vatManifest: {
        format: 'clair-vat-manifest/2',
        companyId: 'FR00000000000',
        count: 500,
        documentsRoot: v.batch.manifest.documentsRoot,
      },
      sources: [{ valid: true }],
    });
    expect(JSON.stringify(vatResult)).not.toContain('netCents');

    expect(errors).not.toContain('Downloading CRS');
  } finally {
    await browser?.close();
    if (child && child.exitCode === null) {
      const exit = once(child, 'exit');
      child.kill();
      await exit;
    }
    await online.close();
    await temp.close();
  }
}, 300000);
