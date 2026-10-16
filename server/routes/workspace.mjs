import { validateCircuit, circuitHash } from '../../shared/circuit.mjs';
import { parseProof, ENGINE } from '../../shared/proof.mjs';
import { fail, input } from '../errors.mjs';
import { createLimit } from '../security.mjs';
export function registerWorkspaceRoutes(app, { repo, sessions, compiler }) {
  const { auth, paid } = sessions;
  app.post('/api/prover/authorize', auth, paid, (req, res) => res.json({ ok: true }));
  app.get('/api/circuits', auth, (req, res) => res.json(repo.listCircuits(req.user.id)));
  app.post('/api/circuits', auth, paid, async (req, res) => {
    const schema = input(() => validateCircuit(req.body)),
      hash = await circuitHash(schema);
    const { created, ...record } = repo.saveCircuit(req.user.id, hash, schema);
    res.status(created ? 201 : 200).json(record);
  });
  app.delete('/api/circuits/:id', auth, (req, res) => {
    repo.deleteCircuit(req.user.id, req.params.id);
    res.json({ ok: true });
  });
  app.post('/api/compile', createLimit(15), async (req, res) => {
    const engine = req.query.engine ?? ENGINE;
    if (typeof engine !== 'string') throw fail(400, 'Moteur invalide.');
    res.json(await compiler.compile(req.body, engine));
  });
  app.get('/api/proofs', auth, (req, res) => res.json(repo.listProofs(req.user.id)));
  app.post('/api/proofs', auth, paid, async (req, res) => {
    const envelope = input(() => parseProof(req.body));
    if (!compiler.engines.includes(envelope.engine))
      throw fail(400, 'Moteur ZK non pris en charge.');
    if ((await circuitHash(envelope.circuit)) !== envelope.circuitHash)
      throw fail(400, 'Empreinte du circuit incorrecte.');
    res.status(201).json(repo.saveProof(req.user.id, envelope));
  });
  app.delete('/api/proofs/:id', auth, (req, res) => {
    repo.deleteProof(req.user.id, req.params.id);
    res.json({ ok: true });
  });
}
