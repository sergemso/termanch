import type { ServerListItem } from './protocol';

/** Turns the tunnel URL a user pasted into the server's WebSocket endpoint. */
export function wsUrl(serverUrl: string): string {
  const url = new URL(serverUrl.trim());
  url.protocol = url.protocol === 'http:' || url.protocol === 'ws:' ? 'ws:' : 'wss:';
  if (url.pathname === '/' || url.pathname === '') url.pathname = '/ws';
  return url.toString();
}

/** Reads the `#add=<base64url json {u,t,n}>` fragment from the link printed by `termanch-server --register`. */
export function parseAddFragment(hash: string): Pick<ServerListItem, 'server_url' | 'server_name' | 'claim'> | null {
  const m = /^#add=([A-Za-z0-9_-]+)$/.exec(hash);
  if (!m) return null;
  try {
    const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
    const data = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)));
    if (typeof data.u !== 'string' || typeof data.t !== 'string') return null;
    wsUrl(data.u);
    return { server_url: data.u, server_name: typeof data.n === 'string' ? data.n : 'my-vps', claim: data.t };
  } catch {
    return null;
  }
}
