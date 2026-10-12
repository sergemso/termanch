import type { ClientMessage, ServerMessage } from './protocol';
import { openRtc } from './rtc';
import { openTransport, Unreachable, type Openers, type Target, type Transport } from './transport';
import { openWs } from './ws';

export type ConnState = 'connecting' | 'connected' | 'reconnecting' | 'unreachable' | 'closed';

const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 30000];
const PING_EVERY_MS = 5000;
const PONG_WITHIN_MS = 3000;

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
  /** Resolved on every attempt, so a reconnect can pick up a new address from the directory. */
  target: () => Promise<Target>;
  openers?: Openers;
  token: () => string;
  claim?: string;
  /** `detail` explains `unreachable`. */
  onState: (state: ConnState, detail?: string) => void;
  /** Called after every successful auth, including after a reconnect. */
  onReady: (msg: Extract<ServerMessage, { type: 'auth_ok' }>, isReconnect: boolean) => void;
  /** Auth errors are final: retrying with the same token would be rejected again. */
  onFatal: (message: string) => void;
}

const DEFAULT_OPENERS: Openers = { rtc: openRtc, ws: openWs };

/** One authenticated connection to a server that heals itself: transport choice, backoff, heartbeat, wake-up on foreground. */
export class Connection {
  private transport: Transport | null = null;
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<(msg: ServerMessage) => void>();
  private authed = false;
  private everReady = false;
  private stopped = false;
  private opening = false;
  private pingSentAt = 0;
  /** Last measured round trip in ms (heartbeat ping to pong), for the status bar. */
  rtt: number | null = null;

  constructor(private opts: ConnectionOptions) {
    document.addEventListener('visibilitychange', this.wake);
    window.addEventListener('online', this.wake);
  }

  /** Which transport is carrying the session, for a connection-quality indicator. */
  get kind(): 'rtc' | 'ws' | null {
    return this.transport?.kind ?? null;
  }

  subscribe(fn: (msg: ServerMessage) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  start() {
    void this.open();
  }

  send(msg: ClientMessage) {
    if (this.transport && this.authed) this.transport.send(JSON.stringify(msg));
  }

  close() {
    this.stopped = true;
    this.clearTimers();
    document.removeEventListener('visibilitychange', this.wake);
    window.removeEventListener('online', this.wake);
    this.transport?.close();
    this.transport = null;
    this.opts.onState('closed');
  }

  private wake = () => {
    if (this.stopped || document.visibilityState === 'hidden') return;
    if (this.transport && this.authed) {
      this.ping(); // the heartbeat will drop it if it went stale while hidden
      this.armPongTimeout();
    } else if (!this.opening) {
      this.reconnectNow();
    }
  };

  private reconnectNow() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.attempt = 0;
    void this.open();
  }

  private scheduleRetry() {
    if (this.stopped) return;
    this.timer = setTimeout(() => void this.open(), backoffDelay(this.attempt++));
  }

  private async open() {
    if (this.stopped || this.opening) return;
    this.opening = true;
    this.clearTimers();
    this.authed = false;
    this.opts.onState(this.everReady ? 'reconnecting' : 'connecting');

    let transport: Transport;
    try {
      transport = await openTransport(await this.opts.target(), this.opts.openers ?? DEFAULT_OPENERS);
    } catch (e) {
      this.opening = false;
      if (this.stopped) return;
      this.opts.onState('unreachable', e instanceof Unreachable ? e.message : 'Server unreachable');
      this.scheduleRetry();
      return;
    }
    this.opening = false;
    if (this.stopped) {
      transport.close();
      return;
    }

    this.transport = transport;
    transport.onmessage = (text) => this.onText(transport, text);
    transport.onclose = () => {
      if (this.transport !== transport || this.stopped) return;
      this.clearTimers();
      this.authed = false;
      this.transport = null;
      this.opts.onState('reconnecting');
      this.scheduleRetry();
    };
    transport.send(JSON.stringify({ type: 'auth', token: this.opts.token(), server_token: this.opts.claim ?? '' }));
  }

  private onText(transport: Transport, text: string) {
    if (this.transport !== transport) return;
    const msg: ServerMessage = JSON.parse(text);
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
      transport.close();
      this.opts.onState('closed');
      this.opts.onFatal(msg.message);
      return;
    }
    if (msg.type === 'pong') {
      if (this.pingSentAt) this.rtt = Math.round(performance.now() - this.pingSentAt);
    } else {
      this.listeners.forEach((fn) => fn(msg));
    }
  }

  private startHeartbeat() {
    this.pingTimer = setInterval(() => this.ping(), PING_EVERY_MS);
  }

  private ping() {
    this.pingSentAt = performance.now();
    this.send({ type: 'ping' });
    this.armPongTimeout();
  }

  private armPongTimeout() {
    if (this.pongTimer) return;
    // Any message counts as proof of life (see heard()); silence means a half-open connection.
    this.pongTimer = setTimeout(() => {
      this.pongTimer = null;
      this.transport?.close();
      // close() on our own transport does not notify; treat it as a drop.
      this.transport?.onclose?.();
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
