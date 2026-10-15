// Web Push on this device (decision 0095): subscribe through the service worker and tell the server. One browser
// subscription exists per service worker and server key, so a device pushes for one server at a time.
import type { ClientMessage } from './protocol';

export type PushResult = 'ok' | 'denied' | 'unsupported';

export function pushSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof PushManager !== 'undefined' && typeof Notification !== 'undefined';
}

/** The server key as the bytes `subscribe` wants. */
export function keyBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64url.length % 4)) % 4);
  const bin = atob((b64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** What the server needs from a browser subscription; null when the browser gave an incomplete one. */
export function subscribeMessage(sub: { endpoint: string; keys?: Record<string, string> }): ClientMessage | null {
  const p256dh = sub.keys?.p256dh;
  const auth = sub.keys?.auth;
  return p256dh && auth ? { type: 'push_subscribe', endpoint: sub.endpoint, p256dh, auth } : null;
}

export async function enablePush(send: (m: ClientMessage) => void, publicKey: string): Promise<PushResult> {
  if (!pushSupported()) return 'unsupported';
  if ((await Notification.requestPermission()) !== 'granted') return 'denied';
  const reg = await navigator.serviceWorker.ready;
  // A subscription made for another server's key cannot be reused: replace it.
  const old = await reg.pushManager.getSubscription();
  if (old) await old.unsubscribe();
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
  const msg = subscribeMessage(sub.toJSON() as { endpoint: string; keys?: Record<string, string> });
  if (!msg) return 'unsupported';
  send(msg);
  return 'ok';
}

export async function disablePush(send: (m: ClientMessage) => void): Promise<void> {
  if (!pushSupported()) return;
  const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
  if (!sub) return;
  send({ type: 'push_unsubscribe', endpoint: sub.endpoint });
  await sub.unsubscribe();
}

export async function currentEndpoint(): Promise<string | null> {
  if (!pushSupported()) return null;
  try {
    return (await (await navigator.serviceWorker.ready).pushManager.getSubscription())?.endpoint ?? null;
  } catch {
    return null;
  }
}
