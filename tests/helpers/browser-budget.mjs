export async function waitForApiBudget(request, minimum = 45) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await request.get('/api/session');
    const header = r.headers().ratelimit ?? '';
    const remaining = Number(/r=(\d+)/.exec(header)?.[1]);
    const reset = Number(/t=(\d+)/.exec(header)?.[1]);
    if (r.ok() && Number.isFinite(remaining) && remaining >= minimum) return;
    const wait = Number.isFinite(reset) ? reset : Number(r.headers()['retry-after'] || 60);
    await new Promise((resolve) => setTimeout(resolve, Math.min(60, Math.max(1, wait + 1)) * 1000));
  }
  throw Error('API rate-limit budget did not recover for the isolated browser test.');
}
