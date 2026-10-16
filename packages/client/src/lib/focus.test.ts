import { describe, expect, it } from 'vitest';
import { rememberFocus } from './focus';

const el = (connected = true) => {
  const e = { isConnected: connected, focused: 0, focus() { this.focused++; } };
  return e;
};

describe('rememberFocus', () => {
  it('gives focus back to what had it, without scrolling the page', () => {
    const terminal = el();
    const doc = { activeElement: terminal as unknown, body: {} };
    const restore = rememberFocus(doc);
    doc.activeElement = {}; // a dialog took it
    restore();
    expect(terminal.focused).toBe(1);
  });
  it('does nothing when only the page body had focus, or the element is gone', () => {
    const body = el();
    rememberFocus({ activeElement: body, body })();
    expect(body.focused).toBe(0);
    const gone = el(false);
    rememberFocus({ activeElement: gone, body: {} })();
    expect(gone.focused).toBe(0);
  });
  it('returns to the terminal input when a button (the one that opened the dialog) had focus', () => {
    const input = el();
    const doc = { activeElement: { tagName: 'BUTTON' } as unknown, body: {}, querySelector: () => input };
    const restore = rememberFocus(doc);
    doc.activeElement = {};
    restore();
    expect(input.focused).toBe(1);
  });
});
