import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import { createRawSnippet } from 'svelte';
import { NativeSelect } from '.';

const options = createRawSnippet(() => ({ render: () => '<option value="a">alpha</option><option value="b">beta</option>' }));
const html = (props: Record<string, unknown>) => render(NativeSelect, { props: { children: options, ...props } }).body;

describe('NativeSelect', () => {
  it('is a real select with a chevron, a 44 px target and 16 px text', () => {
    const out = html({ 'aria-label': 'Server' });
    expect(out).toContain('<select');
    expect(out).toContain('aria-label="Server"');
    expect(out).toContain('alpha');
    expect(out).toContain('data-slot="native-select-icon"');
    expect(out).toMatch(/class="[^"]*\bh-11\b/);
    expect(out).toMatch(/class="[^"]*\btext-base\b/);
    expect(out).toMatch(/class="[^"]*\bappearance-none\b/);
  });
  it('passes attributes through and lets a caller change the class', () => {
    const out = html({ id: 'reply-to', disabled: true, class: 'bg-panel' });
    expect(out).toContain('id="reply-to"');
    expect(out).toContain('disabled');
    expect(out).toMatch(/class="[^"]*\bbg-panel\b/);
    expect(out).not.toMatch(/class="[^"]*\bbg-sunken\b/); // the caller's utility wins over the default
  });
});
