import './network.mjs';
import { verifyOffline } from './verification.mjs';
process.on('message', async ({ proof, snapshot }) => {
  let message;
  try {
    message = { result: await verifyOffline(proof, snapshot) };
  } catch {
    message = {
      error:
        'Vérification impossible : fichier invalide, moteur incompatible ou paramètres locaux insuffisants.',
    };
  }
  process.send(message, () => process.exit(0));
});
