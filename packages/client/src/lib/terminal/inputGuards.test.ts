import { describe, expect, it } from 'vitest';
import { dropColorReplies } from './inputGuards';

describe('dropColorReplies', () => {
  it('drops foreground, background and cursor colour answers', () => {
    expect(dropColorReplies('\x1b]10;rgb:afaf/d7d7/8787\x1b\\')).toBe('');
    expect(dropColorReplies('\x1b]11;rgb:0d0d/1111/1717\x07')).toBe('');
    expect(dropColorReplies('\x1b]12;rgb:5858/a6a6/ffff\x1b\\')).toBe('');
  });
  it('drops palette answers', () => {
    expect(dropColorReplies('\x1b]4;150;rgb:afaf/d7d7/8787\x1b\\')).toBe('');
  });
  it('drops several answers and keeps the rest', () => {
    expect(dropColorReplies('\x1b]10;rgb:a/b/c\x1b\\\x1b]11;rgb:d/e/f\x1b\\ls')).toBe('ls');
  });
  it('drops a whole palette burst, the way tmux asks for all 256 colours', () => {
    const burst = Array.from({ length: 256 }, (_, i) => `\x1b]4;${i};rgb:afaf/d7d7/8787\x1b\\`).join('');
    expect(dropColorReplies(burst + 'x')).toBe('x');
  });
  it('leaves ordinary keys and other sequences alone', () => {
    for (const s of ['a', '\r', '\x1b[A', '\x1b[?1;2c', '\x1b]52;c;aGk=\x07']) expect(dropColorReplies(s)).toBe(s);
  });
});
