import type { ClientMessage, ServerMessage } from './protocol';
import { wsUrl } from './servers';

export type ConnState = 'connecting' | 'connected' | 'reconnecting' | 'closed';

const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 30000];
const PING_EVERY_MS = 15000;
const PONG_WITHIN_MS = 10000;

/** 1s, 2s, 4s, 8s, 16s, then 30s; +0..25% jitter so many tabs do not reconnect in lockstep. */
export function backoffDelay(attempt: number, random = Math.random): number {
  const base = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
  return Math.round(base * (1 + random() * 0.25));
}

export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Keystrokes may be any Unicode; send them as UTF-8 bytes. */
export function textToB64(text: string): string {
  let bin = '';
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin);
}

export interface ConnectionOptions {
  serverUrl: string;
  token: () => string;
  claim?: string;
  onState: (state: ConnState) => void;
  /** Called after every successful auth, including after a reconnect. */
  onReady: (msg: Extract<ServerMessage, { type: 'auth_ok' }>, isReconnect: boolean) => void;
  /** Auth errors are final: retrying with the same token would be rejected again. */
  onFatal: (message: string) => void;
}

/** One authenticated WebSocket to a server that heals itself: backoff, heartbeat, wake-up on foreground. */
export class Connection {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<(msg: ServerMessage) => void>();
  private authed = false;
  private everReady = false;
  private stopped = false;

  constructor(private opts: ConnectionOptions) {
    document.addEventListener('visibilitychange', this.wake);
    window.addEventListener('online', this.wake);
  }

  subscribe(fn: (msg: ServerMessage) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  start() {
    this.open();
  }

  send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN && this.authed) this.ws.send(JSON.stringify(msg));
  }

  close() {
    this.stopped = true;
    this.clearTimers();
    document.removeEventListener('visibilitychange', this.wake);
    window.removeEventListener('online', this.wake);
    this.ws?.close();
    this.ws = null;
    this.opts.onState('closed');
  }

  private wake = () => {
    if (this.stopped || document.visibilityState === 'hidden') return;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: 'ping' }); // the heartbeat will drop it if it went stale while hidden
      this.armPongTimeout();
    } else {
      this.reconnectNow();
    }
  };

  private reconnectNow() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.attempt = 0;
    this.open();
  }

  private open() {
    if (this.stopped) return;
    this.clearTimers();
    this.opts.onState(this.everReady ? 'reconnecting' : 'connecting');
    this.authed = false;
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl(this.opts.serverUrl));
    } catch {
      this.opts.onFatal('Invalid server URL');
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', token: this.opts.token(), server_token: this.opts.claim ?? '' }));
    };
    ws.onmessage = (event) => {
      if (this.ws !== ws) return;
      const msg: ServerMessage = JSON.parse(event.data);
      this.heard();
      if (msg.type === 'auth_ok') {
        const isReconnect = this.everReady;
        this.authed = true;
        this.everReady = true;
        this.attempt = 0;
        this.startHeartbeat();
        this.opts.onState('connected');
        this.opts.onReady(msg, isReconnect);
      } else if (msg.type === 'error' && !this.authed) {
        this.stopped = true;
        ws.close();
        this.opts.onState('closed');
        this.opts.onFatal(msg.message);
        return;
      }
      if (msg.type !== 'pong') this.listeners.forEach((fn) => fn(msg));
    };
    ws.onclose = () => {
      if (this.ws !== ws || this.stopped) return;
      this.clearTimers();
      this.authed = false;
      this.opts.onState('reconnecting');
      this.timer = setTimeout(() => this.open(), backoffDelay(this.attempt++));
    };
    ws.onerror = () => ws.close();
  }

  private startHeartbeat() {
    this.pingTimer = setInterval(() => {
      this.send({ type: 'ping' });
      this.armPongTimeout();
    }, PING_EVERY_MS);
  }

  private armPongTimeout() {
    if (this.pongTimer) return;
    // Any message counts as proof of life (see heard()); silence means a half-open socket.
    this.pongTimer = setTimeout(() => {
      this.pongTimer = null;
      this.ws?.close();
    }, PONG_WITHIN_MS);
  }

  private heard() {
    if (this.pongTimer) clearTimeout(this.pongTimer);
    this.pongTimer = null;
  }

  private clearTimers() {
    if (this.timer) clearTimeout(this.timer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.pongTimer) clearTimeout(this.pongTimer);
    this.timer = this.pingTimer = this.pongTimer = null;
  }
}
