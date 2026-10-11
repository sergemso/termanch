import { handleAnnounce, srcHash, type D1Like } from './_lib';

interface Env {
  DB: D1Like;
  DIRECTORY_SALT?: string;
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  const text = await request.text();
  if (text.length > 2000) return json({ error: 'too large' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'bad json' }, 400);
  }
  const address = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const reply = await handleAnnounce(env.DB, body, await srcHash(address, env.DIRECTORY_SALT ?? ''), Date.now());
  return json(reply.body, reply.status);
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
