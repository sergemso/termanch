// Drives the real client Connection from a test: no Svelte UI, same transport, auth and reconnect code.
import { Connection, b64ToBytes, textToB64, type ConnState } from '../src/lib/connection';
import { deviceKey, publicKeyB64, signChallenge } from '../src/lib/device';
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
  /** Certificate for the key `deviceKey()` returned, issued by the test's stand-in function. */
  cert: string;
  serverId: string;
  claim?: string;
}

const decoder = new TextDecoder();
let connection: Connection | null = null;

const api = {
  /** Public key of this browser's device key, for the test to have a certificate issued. */
  deviceKey: async () => publicKeyB64(await deviceKey()),
  state: 'idle' as ConnState | 'idle',
  ready: 0,
  fatal: '',
  output: '',
  sessions: [] as { id: string; name: string }[],
  kind: () => connection?.kind ?? null,
  start(opts: Opts) {
    connection = new Connection({
      target: async () => ({ record: opts.record as never }),
      credentials: async () => {
        const pair = await deviceKey();
        return { cert: opts.cert, sign: (id, nonce) => signChallenge(pair, id, nonce) };
      },
      serverId: opts.serverId,
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
