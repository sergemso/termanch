/** Turns the tunnel URL a user pasted into the server's WebSocket endpoint. */
export function wsUrl(serverUrl: string): string {
  const url = new URL(serverUrl.trim());
  url.protocol = url.protocol === 'http:' || url.protocol === 'ws:' ? 'ws:' : 'wss:';
  if (url.pathname === '/' || url.pathname === '') url.pathname = '/ws';
  return url.toString();
}
