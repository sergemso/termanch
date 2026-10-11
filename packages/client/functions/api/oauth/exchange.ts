// Cloudflare Pages Function: POST /api/oauth/exchange { code } -> { token, login }
// The GitHub client secret lives only here (Pages secret), never in the browser or on user servers.
// Self-hosters deploy their own copy with their own OAuth app (DECISION-0052).

interface Env {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
}

type Context = { request: Request; env: Env };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const onRequestPost = async ({ request, env }: Context): Promise<Response> => {
  // Same-origin only: the app and this function share a host, so a foreign Origin is never legitimate.
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'forbidden' }, 403);

  let code: unknown;
  try {
    ({ code } = (await request.json()) as { code?: unknown });
  } catch {
    return json({ error: 'bad request' }, 400);
  }
  if (typeof code !== 'string' || code.length === 0 || code.length > 200) {
    return json({ error: 'bad request' }, 400);
  }
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) return json({ error: 'not configured' }, 500);

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const granted = (await tokenRes.json()) as { access_token?: string };
  if (!granted.access_token) return json({ error: 'exchange failed' }, 401);

  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${granted.access_token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'termanch',
    },
  });
  if (!userRes.ok) return json({ error: 'exchange failed' }, 401);
  const user = (await userRes.json()) as { login: string };

  return json({ token: granted.access_token, login: user.login });
};
