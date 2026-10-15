// Everything the terminal sends to the server goes through here. xterm answers a palette query (tmux asks
// for all 256 colours right after an attach) with one reply per colour; sent one by one that is a burst of hundreds
// of messages. Replies that arrive in the same moment travel as one message instead, which the server reads as the
// same bytes in the same order.
export class InputBatcher {
  private pending = '';
  private timer: unknown = null;

  constructor(
    private send: (data: string) => void,
    private setTimer: (fn: () => void, ms: number) => unknown = (fn, ms) => setTimeout(fn, ms),
    private clearTimer: (id: unknown) => void = (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
    private windowMs = 4,
  ) {}

  /** Queues `data`; it goes out within `windowMs`, together with anything queued meanwhile. */
  add(data: string): void {
    this.pending += data;
    if (this.timer === null) this.timer = this.setTimer(() => this.flush(), this.windowMs);
  }

  /** Sends what is queued now (before a resize or a detach, so the order with other messages holds). */
  flush(): void {
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
    if (!this.pending) return;
    const data = this.pending;
    this.pending = '';
    this.send(data);
  }
}
