import type { DirRecord } from './directory';

/** What `Connection` needs from a carrier: ordered JSON text messages and a close notice. */
export interface Transport {
  readonly kind: 'rtc' | 'ws';
  onmessage: ((text: string) => void) | null;
  onclose: (() => void) | null;
  send(text: string): void;
  close(): void;
}

/** Where a server can be reached. A directory record is preferred; a plain WebSocket URL is the fallback. */
export interface Target {
  record?: DirRecord;
  wsUrl?: string;
}

export class Unreachable extends Error {
  constructor(message: string, readonly attempts: string[]) {
    super(message);
  }
}

export interface Openers {
  rtc(record: DirRecord, timeoutMs: number): Promise<Transport>;
  ws(url: string, timeoutMs: number): Promise<Transport>;
}

/** ICE, DTLS and the data channel take several round trips; on a slow mobile link 5 s was too short and looped. */
export const RTC_TIMEOUT_MS = 10000;
export const WS_TIMEOUT_MS = 8000;

/** The user-facing reason when WebRTC could not open: the UDP port is the thing to check. */
export function describeRtcFailure(record: DirRecord): string {
  return `Server unreachable on UDP port ${record.udp_port}. Check that the port is open in the server's firewall and that this network allows UDP.`;
}

/**
 * Opens the best available transport: WebRTC-direct from the directory record first, then the
 * WebSocket (tunnel) fallback. Throws Unreachable with a message the UI can show.
 */
export async function openTransport(target: Target, openers: Openers): Promise<Transport> {
  const attempts: string[] = [];
  let rtcFailure: string | null = null;

  if (target.record) {
    try {
      return await openers.rtc(target.record, RTC_TIMEOUT_MS);
    } catch (e) {
      rtcFailure = describeRtcFailure(target.record);
      attempts.push(`rtc: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const url = target.record?.ws_url || target.wsUrl;
  if (url) {
    try {
      return await openers.ws(url, WS_TIMEOUT_MS);
    } catch (e) {
      attempts.push(`ws: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  throw new Unreachable(rtcFailure ?? 'Server unreachable', attempts);
}
