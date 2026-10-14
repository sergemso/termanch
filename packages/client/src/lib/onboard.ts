// Add Server (DECISION-0056): the user's only job is to get a claim secret onto the VPS, by pasting one
// command (flow A) or scanning a QR the installer shows (flow B). Everything after that is automatic:
// the server announces itself to the directory with a proof that it knows the secret.
import { pending, type DirRecord } from './directory';

/** Secrets are 43 url-safe characters (32 random bytes). */
const SECRET = /^[A-Za-z0-9_-]{43}$/;

/**
 * Where sessions run (DECISION-0058, 0075). The installer takes it as a last word: none for the isolated container,
 * `host-user` for this machine as a dedicated unprivileged user, `host-me` as the user who runs the
 * installer (sessions open on their behalf, in their home), `host` for this machine as root.
 */
export type RunChoice = 'container' | 'host-user' | 'host-me' | 'host';

const modeWord = (mode: RunChoice) => (mode === 'container' ? '' : ` ${mode}`);

export function installCommand(origin: string, secret: string, mode: RunChoice = 'container'): string {
  return `curl -fsSL ${origin}/install.sh | sh -s -- ${secret} ${origin}${modeWord(mode)}`;
}

/** The command for the QR flow: the installer shows a QR instead of taking a secret (`-`). */
export function scanCommand(origin: string, mode: RunChoice = 'container'): string {
  return mode === 'container' ? `curl -fsSL ${origin}/install.sh | sh` : `curl -fsSL ${origin}/install.sh | sh -s -- - ${origin}${modeWord(mode)}`;
}

/** The text the installer's QR encodes: opening it in any camera app starts Add Server in the client. */
export function claimLink(origin: string, secret: string): string {
  return `${origin.replace(/\/$/, '')}/#claim=${secret}`;
}

/** The link that adds an already-registered server on another device (see `parseServerLink`). */
export function serverLink(origin: string, serverId: string): string {
  return `${origin.replace(/\/$/, '')}/#server=${serverId}`;
}

/** Accepts a claim link, a URL fragment (`#claim=...`) or the bare secret. */
export function parseClaim(text: string): string | null {
  const t = text.trim();
  const m = /[#&?]claim=([A-Za-z0-9_-]{43})(?![A-Za-z0-9_-])/.exec(t);
  if (m) return m[1];
  return SECRET.test(t) ? t : null;
}

/** The server id from a re-add link (`#server=...`), as printed by the installer for an already-registered server. */
export function parseServerLink(text: string): string | null {
  const m = /[#&?]server=([A-Za-z0-9_-]{43})(?![A-Za-z0-9_-])/.exec(text.trim());
  return m ? m[1] : null;
}

/** 2 s, 4 s, 8 s, then every 10 s: quick when the server is fast, cheap on the directory when it is not. */
export function pollDelay(attempt: number): number {
  return Math.min(2000 * 2 ** attempt, 10_000);
}

export const CLAIM_WINDOW_MS = 15 * 60_000;

export interface WaitDeps {
  pending: (origin: string, secret: string) => Promise<DirRecord | null>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}

const realDeps: WaitDeps = {
  pending,
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  now: () => Date.now(),
};

export class ClaimTimeout extends Error {
  constructor() {
    super('Nothing arrived within 15 minutes');
  }
}

/**
 * Polls the directory until the server announces itself with this secret. Resolves with the record,
 * already checked for a valid signature and claim proof. Rejects on timeout, abort, or a record that
 * fails verification (which is never retried: someone is answering for our secret and cannot prove it).
 */
export async function waitForServer(
  origin: string,
  secret: string,
  signal: AbortSignal,
  deps: WaitDeps = realDeps,
): Promise<DirRecord> {
  const started = deps.now();
  for (let attempt = 0; ; attempt++) {
    if (signal.aborted) throw new DOMException('aborted', 'AbortError');
    let record: DirRecord | null = null;
    try {
      record = await deps.pending(origin, secret);
    } catch (e) {
      if (e instanceof Error && e.message.includes('claim secret')) throw e;
      // Network or directory hiccup: keep waiting.
    }
    if (record) return record;
    if (deps.now() - started >= CLAIM_WINDOW_MS) throw new ClaimTimeout();
    await deps.sleep(pollDelay(attempt));
  }
}
