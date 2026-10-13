// Screens peeked at before a tab switch (decision 0084). Kept in memory only, never stored or reported: a screen
// can hold anything the user typed.
export const SNAPSHOT_CAP = 20;

export class SnapshotStore {
  private map = new Map<string, { text: string; hash: string }>();

  /** The newest use of a key goes last, so the oldest one is the one dropped at the cap. */
  put(key: string, text: string, hash: string) {
    this.map.delete(key);
    this.map.set(key, { text, hash });
    while (this.map.size > SNAPSHOT_CAP) this.map.delete(this.map.keys().next().value as string);
  }
  /** The hash we hold, so the server can answer "unchanged" instead of sending the screen again. */
  hash(key: string): string | undefined { return this.map.get(key)?.hash; }
  text(key: string): string | null { return this.map.get(key)?.text ?? null; }
  /** An empty snapshot means the manager cannot give one: the plain attach is used. */
  apply(key: string, msg: { text: string; hash: string; unchanged?: boolean }) {
    if (msg.unchanged) { const old = this.map.get(key); if (old) this.put(key, old.text, old.hash); return; }
    if (msg.text) this.put(key, msg.text, msg.hash); else this.map.delete(key);
  }
  forget(key: string) { this.map.delete(key); }
  get size() { return this.map.size; }
}
