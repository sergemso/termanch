import { describe, expect, it } from 'vitest';
import { KeyboardMode } from './keyboardMode';

function setup(opts: { up?: boolean; focused?: boolean } = {}) {
  const calls: string[] = [];
  const field = {
    setAttribute: (n: string, v: string) => calls.push(`${n}=${v}`),
    blur: () => calls.push('blur'),
    focus: () => calls.push('focus'),
  };
  const fn: boolean[] = [];
  const kb = new KeyboardMode({
    field: () => field,
    isFocused: () => opts.focused ?? true,
    isSystemKeyboardUp: () => opts.up ?? false,
    onFnChange: (o) => fn.push(o),
    schedule: (f) => f(),
  });
  return { kb, calls, fn };
}

describe('KeyboardMode', () => {
  it('brings the system keyboard back with blur then focus, which iOS needs after the user hid it', () => {
    const { kb, calls } = setup();
    kb.tap();
    expect(calls).toEqual(['inputmode=text', 'blur', 'focus']);
  });

  it('keeps the system keyboard away while the Fn keyboard is open, and restores it on close', () => {
    const { kb, calls, fn } = setup();
    kb.openFn();
    expect(calls).toEqual(['inputmode=none', 'blur', 'focus']);
    expect(kb.fnOpen).toBe(true);
    calls.length = 0;
    kb.tap(); // while Fn is open a tap only keeps the input active
    expect(calls).toEqual(['focus']);
    calls.length = 0;
    kb.closeFn();
    expect(calls).toEqual(['inputmode=text', 'blur', 'focus']);
    expect(fn).toEqual([true, false]);
  });

  it('toggles Fn', () => {
    const { kb, fn } = setup();
    kb.toggleFn();
    kb.toggleFn();
    expect(fn).toEqual([true, false]);
  });

  it('the keyboard button hides a visible system keyboard and shows a hidden one', () => {
    const up = setup({ up: true, focused: true });
    up.kb.toggleSystem();
    expect(up.calls).toEqual(['blur']);
    const down = setup({ up: false });
    down.kb.toggleSystem();
    expect(down.calls).toEqual(['inputmode=text', 'blur', 'focus']);
  });

  it('the keyboard button closes the Fn keyboard first', () => {
    const { kb, fn } = setup();
    kb.openFn();
    kb.toggleSystem();
    expect(fn).toEqual([true, false]);
  });

  it('keeps the terminal active, without a keyboard, when the user hides the keyboard', () => {
    const { kb, calls } = setup();
    kb.onBlur({ to: null });
    expect(calls).toEqual(['inputmode=none', 'focus']);
  });

  it('does not take focus back from another input or from its own focus moves', () => {
    const other = setup();
    other.kb.onBlur({ to: {} });
    expect(other.calls).toEqual([]);
    // showSystem blurs the field itself; that blur must not trigger the keep-active path
    let kbRef: KeyboardMode;
    const calls: string[] = [];
    const field = {
      setAttribute: (n: string, v: string) => calls.push(`${n}=${v}`),
      blur: () => {
        calls.push('blur');
        kbRef.onBlur({ to: null });
      },
      focus: () => calls.push('focus'),
    };
    kbRef = new KeyboardMode({ field: () => field, isFocused: () => true, isSystemKeyboardUp: () => false, onFnChange: () => {}, schedule: (f) => f() });
    kbRef.showSystem();
    expect(calls).toEqual(['inputmode=text', 'blur', 'focus']);
  });
});
