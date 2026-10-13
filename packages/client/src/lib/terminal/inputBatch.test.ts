import { describe, expect, it } from 'vitest';
import { InputBatcher } from './inputBatch';

function setup() {
  const sent: string[] = [];
  let fire: (() => void) | null = null;
  const b = new InputBatcher(
    (d) => sent.push(d),
    (fn) => ((fire = fn), 1),
    () => (fire = null),
  );
  return { b, sent, tick: () => fire?.() };
}

describe('InputBatcher', () => {
  it('sends 256 palette replies that arrive together as one message, in order', () => {
    const { b, sent, tick } = setup();
    const replies = Array.from({ length: 256 }, (_, i) => `\x1b]4;${i};rgb:eeee/eeee/eeee\x1b\\`);
    for (const r of replies) b.add(r);
    expect(sent).toEqual([]);
    tick();
    expect(sent).toEqual([replies.join('')]);
  });

  it('keeps ordinary typing as one message per pause', () => {
    const { b, sent, tick } = setup();
    b.add('l');
    tick();
    b.add('s');
    tick();
    expect(sent).toEqual(['l', 's']);
  });

  it('flush sends at once and leaves nothing for the timer', () => {
    const { b, sent, tick } = setup();
    b.add('a');
    b.add('b');
    b.flush();
    tick();
    expect(sent).toEqual(['ab']);
    b.flush();
    expect(sent).toEqual(['ab']);
  });
});
