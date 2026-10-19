import {
  privatePrefix,
  decodeBytes,
  privateSignedInputs,
  uuidBytes,
} from '../../shared/private-attestations.mjs';
export function privateSignatureSource(circuit) {
  const params = [],
    checks = [];
  for (const input of privateSignedInputs(circuit)) {
    const n = circuit.inputs.indexOf(input),
      p = 'sig_' + n;
    params.push(
      p + ': [u8;64]',
      p + '_id: [u8;16]',
      p + '_issued: pub u64',
      p + '_expires: pub u64',
    );
    const prefix = privatePrefix(input);
    const value = '(in_' + n + ' as u32)';
    const set = (offset, expr) => 'msg[' + offset + '] = ' + expr + ';';
    const body = [
      'let mut msg: [u8;256] = [0;256];',
      ...prefix.map((b, i) => set(i, String(b))),
      ...Array.from({ length: 4 }, (_, i) =>
        set(153 + i, '((' + value + ' >> ' + (3 - i) * 8 + ') & 255) as u8'),
      ),
      'for j in 0..16 { msg[157+j] = ' + p + '_id[j]; }',
      ...['issued', 'expires'].flatMap((name, k) =>
        Array.from({ length: 8 }, (_, i) =>
          set(173 + k * 8 + i, '((' + p + '_' + name + ' >> ' + (7 - i) * 8 + ') & 255) as u8'),
        ),
      ),
      'msg[189] = 128;',
      'msg[254] = 5;',
      'msg[255] = 232;', // 189 * 8 = 1512 = 0x05e8
      'let mut h: [u32;8] = [1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225];',
      'for block in 0..4 { let mut words: [u32;16] = [0;16]; for w in 0..16 { let j=block*64+w*4; words[w]=(msg[j] as u32)*16777216+(msg[j+1] as u32)*65536+(msg[j+2] as u32)*256+(msg[j+3] as u32); } h=std::hash::sha256_compression(words,h); }',
      'let mut digest: [u8;32] = [0;32]; for j in 0..8 { for k in 0..4 { digest[j*4+k] = ((h[j] >> (((3-k)*8) as u8)) & 255) as u8; } }',
      'assert(' + p + '_issued < ' + p + '_expires);',
      'assert(std::ecdsa_secp256r1::verify_signature(' +
        JSON.stringify([...decodeBytes(input.attestation.publicKey.x)]) +
        ',' +
        JSON.stringify([...decodeBytes(input.attestation.publicKey.y)]) +
        ',' +
        p +
        ',digest));',
    ];
    checks.push('{ ' + body.join('\n') + ' }');
  }
  return { params, checks };
}
export function privateSignatureWitness(circuit, attestations) {
  const result = {};
  for (const input of privateSignedInputs(circuit)) {
    const a = attestations.find((e) => e.inputId === input.id)?.attestation;
    if (!a) throw Error('Attestation privée manquante.');
    const p = 'sig_' + circuit.inputs.indexOf(input);
    // ECDSA accepts equivalent high/low-s signatures; Noir requires low-s.
    const sig = decodeBytes(a.signature),
      order = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');
    const s = BigInt(
      '0x' + Array.from(sig.slice(32), (b) => b.toString(16).padStart(2, '0')).join(''),
    );
    if (s > order / 2n) {
      const low = (order - s).toString(16).padStart(64, '0');
      sig.set(
        low.match(/../g).map((v) => parseInt(v, 16)),
        32,
      );
    }
    result[p] = [...sig];
    result[p + '_id'] = uuidBytes(a.id);
    result[p + '_issued'] = String(Date.parse(a.issuedAt));
    result[p + '_expires'] = String(Date.parse(a.expiresAt));
  }
  return result;
}
