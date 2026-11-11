// Pora — coach IA (Cloudflare Workers AI). POST { prompt } -> { text }
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const SYSTEM = "Tu es un coach de course à pied francophone, précis et bienveillant. Tu réponds toujours en français, en tutoyant, de façon concrète et courte, sans titres ni listes à puces. Tu suis les consignes de style données dans le message.";
export async function onRequestGet({ env }) { return json({ ok: true, ai: !!env.AI }); }
export async function onRequestPost({ request, env }) {
  let prompt;
  try { ({ prompt } = await request.json()); } catch (e) { return json({ error: 'bad_json' }, 400); }
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 8000) return json({ error: 'bad_request' }, 400);
  if (!env.AI) return json({ error: 'no_ai' }, 503);
  const messages = [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }];
  let out = null;
  for (const model of ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-3.1-8b-instruct']) {
    try { out = await env.AI.run(model, { messages, max_tokens: 450, temperature: 0.5 }); if (out && out.response) break; } catch (e) { out = null; }
  }
  const text = out && typeof out.response === 'string' ? out.response.trim() : '';
  return text ? json({ text }) : json({ error: 'no_answer' }, 502);
}
