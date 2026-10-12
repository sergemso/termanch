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

export interface KeyboardDeps {
  field: () => InputField | null;
  /** Whether the field is the focused element. */
  isFocused: () => boolean;
  /** Whether a system keyboard is on screen (the visual viewport shrank by a keyboard's height). */
  isSystemKeyboardUp: () => boolean;
  onFnChange: (open: boolean) => void;
}

export class KeyboardMode {
  fnOpen = false;

  constructor(private deps: KeyboardDeps) {}

  /** Brings the system keyboard up (also when the field still has focus but the keyboard was hidden). */
  showSystem(): void {
    const f = this.deps.field();
    if (!f) return;
    f.setAttribute('inputmode', 'text');
    f.blur();
    f.focus();
  }

  openFn(): void {
    const f = this.deps.field();
    if (!f) return;
    this.set(true);
    f.setAttribute('inputmode', 'none');
    f.blur();
    f.focus();
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
