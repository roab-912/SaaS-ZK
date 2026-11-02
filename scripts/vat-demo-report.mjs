import os from 'node:os';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
export function summarize(values) {
  if (!values.length || values.some((v) => !Number.isFinite(v) || v < 0))
    throw Error('Mesures absentes ou invalides.');
  const sorted = [...values].sort((a, b) => a - b),
    n = sorted.length;
  return {
    samples: n,
    min: sorted[0],
    median: n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2,
    max: sorted.at(-1),
  };
}
export async function measurementEnvironment(browser) {
  let gitHead = 'indisponible',
    dirty = true;
  try {
    gitHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim());
  } catch {}
  const hash = createHash('sha256');
  async function walk(dir) {
    for (const e of (await readdir(dir, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const p = join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else {
        hash.update(p.replaceAll('\\', '/'));
        hash.update(await readFile(p));
      }
    }
  }
  for (const dir of ['src', 'server', 'shared', 'zk']) await walk(dir);
  return {
    os: os.platform() + ' ' + os.release(),
    arch: os.arch(),
    cpu: os.cpus()[0]?.model ?? 'inconnu',
    logicalCpus: os.cpus().length,
    ramGiB: Math.round((os.totalmem() / 1073741824) * 10) / 10,
    node: process.version,
    chromium: browser.version(),
    playwright: JSON.parse(await readFile('node_modules/@playwright/test/package.json', 'utf8'))
      .version,
    gitHead,
    dirty,
    sourceSha256: hash.digest('hex'),
    lockSha256: createHash('sha256')
      .update(await readFile('package-lock.json'))
      .digest('hex'),
    viewport: { width: 1440, height: 1050 },
    headless: true,
    memoryPeakMeasured: false,
  };
}
const seconds = (n) => (n / 1000).toFixed(3) + ' s';
export function benchmarkMarkdown(report) {
  const lines = [
    '# Mesures réelles — démonstration TVA Clair',
    '',
    'Mesures effectuées le ' +
      new Date(report.startedAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) +
      ' (Europe/Paris), sur un seul poste. Ces résultats ne sont ni une garantie de débit ni une estimation sur smartphone.',
    '',
    '## Configuration',
    '',
    ...Object.entries(report.environment)
      .filter(([, v]) => typeof v !== 'object')
      .map(([k, v]) => '- ' + k + ' : ' + v),
    '',
    'Moteur : Noir / UltraHonk. Validation UBL officielle embarquée dans le navigateur. Serveur local construit avec Vite, base en mémoire, registre de démonstration réellement servi par l’API, sans interception des routes. Aucun paiement Stripe.',
    '',
    '## Temps observés dans l’interface',
    '',
    '| Documents | Passage | Import et validation | Signature du relevé | Chargement du lot signé | Génération complète | Vérification anonyme | Fichier de preuve |',
    '|---:|---|---:|---:|---:|---:|---:|---:|',
  ];
  for (const r of report.runs)
    lines.push(
      '| ' +
        [
          r.count,
          r.repetition === 1 ? 'Premier passage' : 'Répétition ' + r.repetition,
          seconds(r.importMs),
          seconds(r.signMs),
          seconds(r.loadSignedMs),
          seconds(r.generateMs),
          seconds(r.verifyMs),
          r.proofBytes + ' octets',
        ].join(' | ') +
        ' |',
    );
  lines.push(
    '',
    '## Synthèse des répétitions',
    '',
    '| Documents | Répétitions | Import médian (min–max) | Génération médiane (min–max) | Vérification médiane |',
    '|---:|---:|---|---|---|',
  );
  for (const count of [...new Set(report.runs.map((r) => r.count))]) {
    const rows = report.runs.filter((r) => r.count === count),
      imp = summarize(rows.map((r) => r.importMs)),
      gen = summarize(rows.map((r) => r.generateMs)),
      ver = summarize(rows.map((r) => r.verifyMs));
    lines.push(
      '| ' +
        [
          count,
          rows.length,
          seconds(imp.median) + ' (' + seconds(imp.min) + ' – ' + seconds(imp.max) + ')',
          seconds(gen.median) + ' (' + seconds(gen.min) + ' – ' + seconds(gen.max) + ')',
          seconds(ver.median),
        ].join(' | ') +
        ' |',
    );
  }
  lines.push(
    '',
    '## Méthode et limites',
    '',
    '- Les durées sont mesurées par l’horloge du navigateur, du changement de fichier ou clic jusqu’à l’affichage du résultat, via un observateur DOM. Elles incluent donc le rendu et son instrumentation.',
    '- Import : lecture et validation XSD, EN 16931 et Peppol, normalisation et contrôles du lot. Le temps passé dans l’explorateur de fichiers est exclu.',
    '- Signature : engagement du lot, empreinte des documents et signature ECDSA.',
    '- Vérification anonyme : reconstruction du circuit public, initialisation du moteur, contrôle cryptographique, signature et registre. Ce temps ne représente pas la seule opération mathématique de vérification.',
    '- Génération complète : contrôles, autorisation de quota, compilation publique HTTP, calcul ZK et vérification locale, finalisation du quota et rafraîchissement de l’interface. Ce n’est pas un chronométrage isolé du seul prouveur.',
    '- Chaque passage ouvre un contexte navigateur neuf et un nouveau worker. Le même processus serveur et son cache de compilation sont réutilisés : le premier passage de chaque capacité prépare son circuit ; les suivants bénéficient du cache serveur. Il ne s’agit pas de redémarrages à froid du système.',
    '- Les paramètres publics cryptographiques peuvent nécessiter Internet. Les domaines contactés sont listés dans mesures.json. Une préparation préalable est nécessaire pour une présentation sans surprise.',
    '- La mémoire maximale du navigateur/WASM n’est pas mesurée. La RAM indiquée est celle du poste.',
    '- Les documents, identités et opérations commerciales sont fictifs ; les signatures et preuves cryptographiques sont réelles. L’acceptation par les validateurs embarqués ne certifie ni une opération réelle ni l’acceptation d’une déclaration par une administration.',
    '',
    '## Contrôles de la démonstration',
    '',
  );
  if (report.verifierCircuitChecks?.length) {
    lines.push(
      '| Documents | Total XML de référence | Total prouvé | Circuit attendu vérifié |',
      '|---:|---:|---:|---|',
    );
    for (const check of report.verifierCircuitChecks)
      lines.push(
        '| ' +
          check.count +
          ' | ' +
          check.referenceNetCents +
          ' centimes | ' +
          check.provedNetCents +
          ' centimes | ' +
          (check.valid ? 'Oui' : 'Non') +
          ' |',
      );
    lines.push(
      '',
      'Ces contrôles supplémentaires rapprochent les TaxAmount des XML et les paramètres publics des preuves, puis revérifient les fichiers livrés avec l’empreinte du circuit attendu. Un rapport PDF public est joint à chaque lot.',
      '',
    );
  }
  for (const e of report.checks)
    lines.push(
      '- ' + e.id + ' : ' + (e.passed ? 'rejet attendu constaté' : 'ÉCHEC') + ' — ' + e.observed,
    );
  if (report.failure) lines.push('', '## Exécution interrompue', '', report.failure);
  lines.push(
    '',
    'État : ' +
      report.status +
      '. Les fichiers sources du lot restent dans le kit local ; aucun document privé réel n’a été utilisé.',
    '',
  );
  return lines.join('\n');
}
export async function writeBenchmarkReport(directory, report) {
  await writeFile(join(directory, 'mesures.json'), JSON.stringify(report, null, 2));
  const keys = [
    'count',
    'repetition',
    'importMs',
    'signMs',
    'loadSignedMs',
    'generateMs',
    'verifyMs',
    'proofBytes',
    'proofValid',
  ];
  await writeFile(
    join(directory, 'mesures.csv'),
    keys.join(',') +
      '\n' +
      report.runs.map((r) => keys.map((k) => r[k]).join(',')).join('\n') +
      '\n',
  );
  await writeFile(join(directory, 'RESULTATS.md'), benchmarkMarkdown(report));
}
export function kitReadme(directory, config) {
  return (
    '# Kit TVA fictif — Clair\n\nTous les XML, identités, clés et montants de ce kit sont des exemples. La clé privée fournie sert uniquement à reproduire la démonstration et ne doit jamais devenir une source réelle.\n\n## Rejouer\n\nDepuis la racine du projet :\n\n    npm run demo:tva:serve -- "' +
    relative(process.cwd(), directory).replaceAll('\\', '/') +
    '"\n\nOuvrir http://localhost:3002. Ce serveur utilise une base en mémoire indépendante, un abonnement synthétique et aucun paiement. Ctrl+C l’arrête.\n\nEntreprise : ' +
    config.credentials.user.email +
    '\nMot de passe local de démonstration : ' +
    config.credentials.user.password +
    '\n\nAutorité (administrateur de ce serveur isolé) : ' +
    config.credentials.admin.email +
    '\nMot de passe local de démonstration : ' +
    config.credentials.admin.password +
    '\n\nLes deux comptes n’existent que dans la démonstration locale. Le compte entreprise ne peut pas approuver une source.\n\n## Déroulé\n\n1. Se connecter comme entreprise, choisir Mes circuits puis TVA collectée.\n2. Importer les XML de lots/10/xml (période du 01/09/2026 au 30/09/2026).\n3. Continuer vers la signature et confirmer l’exhaustivité fictive. Importer source/demo-tva.cle-privee.clair puis signer. En situation réelle, cette action appartient à l’émetteur autorisé.\n4. Continuer vers la preuve et conserver le montant calculé. Générer puis télécharger la preuve.\n5. Ouvrir une fenêtre privée, vérifier lots/10/preuve-valide.preuve.clair sans compte et lire le montant, la période, l’entreprise et la source. Le détail des factures n’est pas joint.\n6. Rejouer les erreurs du dossier erreurs selon EXPLICATIONS.md et consulter RESULTATS.md.\n\nLa source demo-tva est préapprouvée uniquement dans la base fictive isolée. Pour vérifier ces preuves sur une autre instance, son administrateur doit décider d’approuver cette source fictive et importer sa clé publique. Ne jamais la conserver dans un registre de production.\n\nLes relevés signés expirent après 90 jours : régénérer le kit avant une démonstration ultérieure. Le même XML peut être réutilisé, les signatures et preuves sont randomisées et renouvelées.\n'
  );
}

export async function copyClientDocuments(directory) {
  for (const name of ['FICHE-CLIENT.md', 'PILOTE.md', 'DEMONSTRATION.md']) {
    let text = await readFile(join('docs/demo-tva', name), 'utf8');
    text = text
      .replaceAll('MESURES-2026-11-02.md', 'RESULTATS.md')
      .replace('les mesures réalisées le 02/11/2026', 'les mesures de cette exécution');
    await writeFile(join(directory, name), text);
  }
}
