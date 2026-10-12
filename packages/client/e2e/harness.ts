// Drives the real client Connection from a test: no Svelte UI, same transport, auth and reconnect code.
import { Connection, b64ToBytes, textToB64, type ConnState } from '../src/lib/connection';
import type { ClientMessage, ServerMessage } from '../src/lib/protocol';

// Keep every peer connection so a test can cut the transport the way a network drop would.
const peers: RTCPeerConnection[] = [];
const NativePeer = window.RTCPeerConnection;
window.RTCPeerConnection = class extends NativePeer {
  constructor(...args: ConstructorParameters<typeof NativePeer>) {
    super(...args);
    peers.push(this);
  }
} as typeof RTCPeerConnection;

interface Opts {
  record: { ip: string; udp_port: number; fingerprint: string };
  token: string;
  claim?: string;
}

const decoder = new TextDecoder();
let connection: Connection | null = null;

const api = {
  state: 'idle' as ConnState | 'idle',
  ready: 0,
  fatal: '',
  output: '',
  sessions: [] as { id: string; name: string }[],
  kind: () => connection?.kind ?? null,
  start(opts: Opts) {
    connection = new Connection({
      target: async () => ({ record: opts.record as never }),
      token: () => opts.token,
      claim: opts.claim,
      onState: (s) => (api.state = s),
      onReady: (_msg, isReconnect) => {
        api.ready++;
        if (isReconnect) connection?.send({ type: 'list_sessions' });
      },
      onFatal: (m) => (api.fatal = m),
    });
    connection.subscribe((m: ServerMessage) => {
      if (m.type === 'output') api.output += decoder.decode(b64ToBytes(m.data), { stream: true });
      if (m.type === 'sessions') api.sessions = m.sessions;
      if (m.type === 'session_attached') connection?.send({ type: 'resize', cols: 120, rows: 30 });
    });
    connection.start();
  },
  send: (msg: ClientMessage) => connection?.send(msg),
  type: (text: string) => connection?.send({ type: 'input', data: textToB64(text) }),
  clear: () => (api.output = ''),
  dropTransport: () => peers.forEach((p) => p.close()),
};

(window as unknown as { __e2e: typeof api }).__e2e = api;
