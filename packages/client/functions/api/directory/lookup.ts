import { handleLookup, type D1Like } from './_lib';

export const onRequestGet = async ({ request, env }: { request: Request; env: { DB: D1Like } }): Promise<Response> => {
  const reply = await handleLookup(env.DB, new URL(request.url).searchParams.get('id'), Date.now());
  return new Response(JSON.stringify(reply.body), {
    status: reply.status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};
