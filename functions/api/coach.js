// Pora — coach IA (Cloudflare Workers AI).
// POST { prompt } -> { text }                              (analyse d'une course)
// POST { system, messages, stream } -> { text } ou flux SSE (conversation)
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS } });
export async function onRequestOptions() { return new Response(null, { status: 204, headers: CORS }); }
const BASE = "Tu es un coach de course à pied francophone, compétent et humain. Tu réponds toujours en français, en tutoyant. Réponds d'abord directement à la question posée, puis donne la raison en une phrase et une action concrète. Quand les données de la personne sont fournies, appuie-toi dessus et cite ses chiffres ; n'invente jamais de chiffre. Pas de titres, pas de listes à puces, pas d'astérisques, pas de formules creuses. Repères fiables : environ 80 % du volume en endurance facile ; pas plus de 10 % de volume en plus d'une semaine à l'autre ; une séance manquée ne se rattrape pas en doublant ; un jour facile ou de repos entre deux séances dures ; un café avant de courir ne pose pas de problème ; les étirements ne préviennent pas les blessures ; une douleur qui modifie la foulée, présente au repos ou avec gonflement impose l'arrêt et l'avis d'un professionnel de santé. Tu n'es pas médecin et tu ne poses pas de diagnostic. Si la question sort de la course, réponds quand même simplement et utilement. Tu suis les consignes de style données dans le message.";
const MODELS = ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-3.1-8b-instruct'];
export async function onRequestGet({ env }) { return json({ ok: true, ai: !!env.AI }); }
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'bad_json' }, 400); }
  if (!env.AI) return json({ error: 'no_ai' }, 503);
  let messages;
  if (Array.isArray(body.messages)) {
    const turns = body.messages.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim()).slice(-14).map(m => ({ role: m.role, content: m.content.slice(0, 1500) }));
    while (turns.length && turns[0].role !== 'user') turns.shift();
    if (!turns.length || turns[turns.length - 1].role !== 'user') return json({ error: 'bad_request' }, 400);
    messages = [{ role: 'system', content: BASE + (typeof body.system === 'string' ? '\n' + body.system.slice(0, 6000) : '') }, ...turns];
  } else {
    let prompt = body.prompt;
    if (typeof prompt !== 'string' || !prompt.trim()) return json({ error: 'bad_request' }, 400);
    // Les longs messages sont raccourcis, jamais refusés : on garde le début (contexte) et la fin (la question).
    if (prompt.length > 14000) prompt = prompt.slice(0, 5000) + '\n[…]\n' + prompt.slice(-9000);
    messages = [{ role: 'system', content: BASE }, { role: 'user', content: prompt }];
  }
  if (body.stream === true) {
    for (const model of MODELS) {
      try {
        const stream = await env.AI.run(model, { messages, max_tokens: 500, temperature: 0.4, stream: true });
        if (stream) return new Response(stream, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', ...CORS } });
      } catch (e) {}
    }
    return json({ error: 'no_answer' }, 502);
  }
  let out = null;
  for (const model of MODELS) {
    try { out = await env.AI.run(model, { messages, max_tokens: 500, temperature: 0.4 }); if (out && out.response) break; } catch (e) { out = null; }
  }
  const text = out && typeof out.response === 'string' ? out.response.trim() : '';
  return text ? json({ text }) : json({ error: 'no_answer' }, 502);
}
