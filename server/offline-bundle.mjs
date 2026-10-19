import { Zip, ZipPassThrough, strToU8 } from 'fflate';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
export const OFFLINE_LAUNCHER =
  '@echo off\r\nsetlocal\r\npushd "%~dp0"\r\nset "NODE_OPTIONS="\r\nset "NODE_PATH="\r\nif not exist "logiciel\\node.exe" (\r\n powershell.exe -NoProfile -NonInteractive -Command "Expand-Archive -LiteralPath \'logiciel.zip\' -DestinationPath \'logiciel\' -Force"\r\n if errorlevel 1 goto failed\r\n)\r\npushd "logiciel"\r\nnode.exe --import ./offline/network.mjs ./offline/server.mjs --trust ../sources.clair\r\npopd\r\npopd\r\npause\r\nexit /b\r\n:failed\r\necho Extraction impossible. Decompressez logiciel.zip dans un dossier logiciel.\r\npopd\r\npause\r\nexit /b 1\r\n';
export const OFFLINE_README =
  'Clair — Vérificateur hors ligne Windows x64\r\n\r\n1. Extraire toute cette archive ZIP.\r\n2. Double-cliquer sur demarrer.cmd. Le logiciel extrait son moteur au premier lancement.\r\n3. Ouvrir le fichier de preuve .clair dans la fenêtre du navigateur. Aucune connexion Internet ni installation de Node.js nécessaire.\r\n\r\nLes sources approuvées sont celles de sources.clair à la date de son export. Les révocations ultérieures sont inconnues hors ligne. Retélécharger le logiciel pour actualiser les sources. Les dates sont contrôlées selon l’horloge locale. Vérifier le circuit et son résultat, pas seulement la validité cryptographique.\r\n\r\nNe lancer que le logiciel obtenu depuis votre instance Clair de confiance. Le logiciel reconstruit les circuits et n’accepte pas de clé de vérification arbitraire jointe à une preuve. Fermer la console avec Ctrl+C pour arrêter.\r\n';
export async function offlineRelease(directory = resolve('data/offline')) {
  try {
    const release = JSON.parse(await readFile(join(directory, 'release.json'), 'utf8')),
      file = await stat(join(directory, 'logiciel.zip'));
    if (
      release.format !== 'clair-offline-release/1' ||
      release.platform !== 'win32-x64' ||
      release.bytes !== file.size ||
      !/^[a-f0-9]{64}$/.test(release.sha256)
    )
      throw Error();
    return { available: true, ...release };
  } catch {
    return { available: false, platform: 'win32-x64' };
  }
}
export async function streamOfflineBundle(
  res,
  snapshot,
  { directory = resolve('data/offline') } = {},
) {
  const release = await offlineRelease(directory);
  if (!release.available) throw Error('Vérificateur hors ligne indisponible.');
  res.type('application/zip');
  res.attachment('clair-verificateur-hors-ligne-' + snapshot.exportedAt.slice(0, 10) + '.zip');
  let draining = false;
  const zip = new Zip((error, data, final) => {
    if (error) {
      res.destroy(error);
      return;
    }
    if (!res.write(data)) draining = true;
    if (final) res.end();
  });
  const small = (name, data) => {
    const entry = new ZipPassThrough(name);
    zip.add(entry);
    entry.push(strToU8(data), true);
  };
  small('sources.clair', JSON.stringify(snapshot, null, 2));
  small('demarrer.cmd', OFFLINE_LAUNCHER);
  small('LIRE-MOI.txt', OFFLINE_README);
  small('logiciel.sha256', release.sha256 + '  logiciel.zip\r\n');
  const entry = new ZipPassThrough('logiciel.zip');
  zip.add(entry);
  const stream = createReadStream(join(directory, 'logiciel.zip'));
  const abort = () => {
    stream.destroy();
    zip.terminate();
  };
  res.once('close', abort);
  try {
    for await (const chunk of stream) {
      if (res.destroyed) break;
      entry.push(chunk, false);
      if (draining && !res.destroyed) {
        draining = false;
        await new Promise((resolve) => {
          const done = () => {
            res.off('drain', done);
            res.off('close', done);
            resolve();
          };
          res.once('drain', done);
          res.once('close', done);
        });
      }
    }
    if (!res.destroyed) {
      entry.push(new Uint8Array(), true);
      zip.end();
    }
  } finally {
    res.off('close', abort);
  }
}
