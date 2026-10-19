export async function api(path, body, method, { signal } = {}) {
  const response = await fetch('/api' + path, {
    method: method || (body === undefined ? 'GET' : 'POST'),
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
    credentials: 'same-origin',
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw Error('Réponse du serveur invalide. Réessayez.');
  }
  if (response.headers?.get('X-Clair-Protocol') !== '3')
    throw Error(
      'Le serveur utilise une ancienne version de Clair. Arrêtez-le avec Ctrl+C, relancez demarrer.cmd, puis rechargez cette page.',
    );
  if (!response.ok) throw Error(result?.error || 'Requête impossible.');
  return result;
}
