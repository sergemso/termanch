import { wsUrl } from './servers';
import type { Transport } from './transport';

class WsTransport implements Transport {
  readonly kind = 'ws' as const;
  onmessage: ((text: string) => void) | null = null;
  onclose: (() => void) | null = null;
  private closed = false;

  constructor(private ws: WebSocket) {
    ws.onmessage = (e) => typeof e.data === 'string' && this.onmessage?.(e.data);
    ws.onclose = () => this.finish();
    ws.onerror = () => ws.close();
  }

  send(text: string) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(text);
  }

  close() {
    this.closed = true;
    this.ws.close();
  }

  private finish() {
    if (this.closed) return;
    this.closed = true;
    this.onclose?.();
  }
}

export function openWs(url: string, timeoutMs: number): Promise<Transport> {
  return new Promise((resolve, reject) => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl(url));
    } catch {
      reject(new Error('invalid WebSocket URL'));
      return;
    }
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`no WebSocket after ${timeoutMs} ms`));
    }, timeoutMs);
    ws.onopen = () => {
      clearTimeout(timer);
      resolve(new WsTransport(ws));
    };
    ws.onerror = () => {
      clearTimeout(timer);
      reject(new Error('WebSocket failed'));
    };
  });
}
