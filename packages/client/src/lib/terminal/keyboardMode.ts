// Which keyboard serves the terminal: the system one, or the on-screen Fn grid. All the iOS quirks are here:
// the system keyboard comes back only if the hidden field is blurred and focused again inside a tap (iOS keeps
// focus on the field when the user hides the keyboard), and `inputmode="none"` keeps the system keyboard away
// while the field stays focused so the cursor stays live.

/** What the controller needs from the terminal's hidden input (a textarea in the browser). */
export interface InputField {
  setAttribute(name: string, value: string): void;
  blur(): void;
  focus(): void;
}

export interface BlurInfo {
  /** The element that gets focus instead, if any (another input, a dialog). */
  to: unknown;
}

export interface KeyboardDeps {
  field: () => InputField | null;
  /** Whether the field is the focused element. */
  isFocused: () => boolean;
  /** Whether a system keyboard is on screen (the visual viewport shrank by a keyboard's height). */
  isSystemKeyboardUp: () => boolean;
  onFnChange: (open: boolean) => void;
  /** Runs `fn` after the current event; replaced in tests. */
  schedule?: (fn: () => void) => void;
}

export class KeyboardMode {
  fnOpen = false;
  /** Set while this controller moves focus itself, so its own blur is not mistaken for the user's. */
  private busy = false;

  private schedule: (fn: () => void) => void;

  constructor(private deps: KeyboardDeps) {
    this.schedule = deps.schedule ?? ((fn) => void setTimeout(fn, 0));
  }

  /** Brings the system keyboard up (also when the field still has focus but the keyboard was hidden). */
  showSystem(): void {
    const f = this.deps.field();
    if (!f) return;
    this.refocus(f, 'text');
  }

  openFn(): void {
    const f = this.deps.field();
    if (!f) return;
    this.set(true);
    this.refocus(f, 'none');
  }

  /**
   * The field lost focus. When the user hid the keyboard (OK or the keyboard's own hide key) nothing else took the
   * focus, so keep the terminal active: focus it again with `inputmode="none"`, which shows no keyboard. A tap on
   * the terminal or the keyboard button brings the keyboard back.
   */
  onBlur(info: BlurInfo): void {
    if (this.busy || info.to) return; // our own move, or focus went to something else on purpose
    const f = this.deps.field();
    if (!f) return;
    f.setAttribute('inputmode', 'none');
    this.schedule(() => this.guard(() => f.focus()));
  }

  private refocus(f: InputField, mode: 'text' | 'none'): void {
    this.guard(() => {
      f.setAttribute('inputmode', mode);
      f.blur();
      f.focus();
    });
  }

  private guard(fn: () => void): void {
    this.busy = true;
    try {
      fn();
    } finally {
      this.busy = false;
    }
  }

  closeFn(): void {
    this.set(false);
    this.showSystem();
  }

  toggleFn(): void {
    if (this.fnOpen) this.closeFn();
    else this.openFn();
  }

  /** The keyboard button: hide the system keyboard when it is up, show it when it is not. */
  toggleSystem(): void {
    if (this.fnOpen) return this.closeFn();
    if (this.deps.isSystemKeyboardUp() && this.deps.isFocused()) this.deps.field()?.blur();
    else this.showSystem();
  }

  /** A tap on the terminal: make it active, bringing the keyboard (system or Fn) back if it was hidden. */
  tap(): void {
    if (this.fnOpen) this.deps.field()?.focus();
    else this.showSystem();
  }

  private set(open: boolean): void {
    this.fnOpen = open;
    this.deps.onFnChange(open);
  }
}
