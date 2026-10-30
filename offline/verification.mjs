import { createNoirNode } from '../zk/noir/node.mjs';
import { circomBrowsers } from '../zk/circom/browser.mjs';
import { createEngineRegistry } from '../zk/registry.mjs';
import { compileNoir } from '../zk/noir/compiler.mjs';
import { compileCircom } from '../zk/circom/compiler.mjs';
import { executeZkOperation } from '../zk/operations.mjs';
import { parseProof, readablePublicValues } from '../shared/proof.mjs';
import { ENGINE } from '../shared/engines.mjs';
import { describe, circuitHash } from '../shared/circuit.mjs';
import { validateTrustSnapshot } from '../shared/trust-snapshot.mjs';
import { resolve } from 'node:path';
export async function verifyOffline(raw, rawSnapshot, { crsPath = resolve('data/noir-crs') } = {}) {
  const envelope = parseProof(raw),
    snapshot = await validateTrustSnapshot(rawSnapshot);
  if ((await circuitHash(envelope.circuit)) !== envelope.circuitHash)
    throw Error('Empreinte du circuit incorrecte.');
  const compiled =
    envelope.engine === ENGINE
      ? await compileNoir(envelope.circuit)
      : await compileCircom(envelope.circuit, envelope.engine);
  const noir = createNoirNode({ crsPath });
  const registry = createEngineRegistry([noir, ...circomBrowsers], ['verify']);
  const result = await executeZkOperation(
    { mode: 'verify', envelope, compiled, issuers: snapshot.issuers },
    registry,
  );
  return {
    ...result,
    result: envelope.result ?? true,
    circuitName: envelope.circuit.name,
    circuitHash: envelope.circuitHash,
    statement: describe(envelope.circuit),
    publicData: readablePublicValues(envelope),
    ...(envelope.vatManifest ? { vatManifest: envelope.vatManifest } : {}),
    snapshot: { exportedAt: snapshot.exportedAt, origin: snapshot.origin },
    checkedAt: new Date().toISOString(),
  };
}
