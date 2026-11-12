// Pora — sauvegarde en ligne (Cloudflare KV). Clé = code de récupération (haché côté serveur).
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,PUT,OPTIONS', 'access-control-allow-headers': 'content-type,x-pora-key' };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS } });
export async function onRequestOptions() { return new Response(null, { status: 204, headers: CORS }); }
const valid = k => typeof k === 'string' && /^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/.test(k);
async function slot(code) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('pora:' + code));
  return 'u:' + [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function onRequestGet({ request, env }) {
  const code = request.headers.get('x-pora-key');
  if (!valid(code)) return json({ error: 'bad_key' }, 400);
  if (!env.PORA_KV) return json({ error: 'no_store' }, 503);
  const v = await env.PORA_KV.get(await slot(code));
  return v ? new Response(v, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS } }) : json({ error: 'not_found' }, 404);
}
export async function onRequestPut({ request, env }) {
  const code = request.headers.get('x-pora-key');
  if (!valid(code)) return json({ error: 'bad_key' }, 400);
  if (!env.PORA_KV) return json({ error: 'no_store' }, 503);
  const body = await request.text();
  if (body.length > 8_000_000) return json({ error: 'too_big' }, 413);
  try { const o = JSON.parse(body); if (!o || typeof o !== 'object' || !o.profile) throw 0; } catch (e) { return json({ error: 'bad_body' }, 400); }
  await env.PORA_KV.put(await slot(code), body);
  return json({ ok: true, at: Date.now() });
}
