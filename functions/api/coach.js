// Pora — coach IA (Cloudflare Workers AI). POST { prompt } -> { text }
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS } });
export async function onRequestOptions() { return new Response(null, { status: 204, headers: CORS }); }
const SYSTEM = "Tu es un coach de course à pied francophone, précis et bienveillant. Tu réponds toujours en français, en tutoyant, de façon concrète et courte, sans titres ni listes à puces. Tu suis les consignes de style données dans le message.";
export async function onRequestGet({ env }) { return json({ ok: true, ai: !!env.AI }); }
export async function onRequestPost({ request, env }) {
  let prompt;
  try { ({ prompt } = await request.json()); } catch (e) { return json({ error: 'bad_json' }, 400); }
  if (typeof prompt !== 'string' || !prompt.trim()) return json({ error: 'bad_request' }, 400);
  // Long conversations are trimmed, never refused: keep the start (coach context) and the end (the question).
  if (prompt.length > 14000) prompt = prompt.slice(0, 5000) + '\n[…]\n' + prompt.slice(-9000);
  if (!env.AI) return json({ error: 'no_ai' }, 503);
  const messages = [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }];
  let out = null;
  for (const model of ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-3.1-8b-instruct']) {
    try { out = await env.AI.run(model, { messages, max_tokens: 450, temperature: 0.5 }); if (out && out.response) break; } catch (e) { out = null; }
  }
  const text = out && typeof out.response === 'string' ? out.response.trim() : '';
  return text ? json({ text }) : json({ error: 'no_answer' }, 502);
}
