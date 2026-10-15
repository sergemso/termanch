import { describe, it, expect, vi } from 'vitest';
import { sendServerLink } from './share';

const link = `https://app.example.dev/#server=${'K'.repeat(43)}`;

describe('sendServerLink', () => {
  it('opens the share sheet with the link when the browser has one', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const copy = vi.fn();
    expect(await sendServerLink(link, 'box', { share, copy })).toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 'Termenbox', text: 'Open box in Termenbox', url: link });
    expect(copy).not.toHaveBeenCalled();
  });

  it('treats closing the sheet as cancelled, not as a failure to copy over', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('closed', 'AbortError'));
    const copy = vi.fn();
    expect(await sendServerLink(link, 'box', { share, copy })).toBe('cancelled');
    expect(copy).not.toHaveBeenCalled();
  });

  it('copies the link when there is no share sheet or it fails', async () => {
    const copy = vi.fn().mockResolvedValue(true);
    expect(await sendServerLink(link, 'box', { copy })).toBe('copied');
    expect(copy).toHaveBeenCalledWith(link);
    const share = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
    expect(await sendServerLink(link, 'box', { share, copy })).toBe('copied');
  });

  it('reports failure when nothing worked', async () => {
    expect(await sendServerLink(link, '', { copy: async () => false })).toBe('failed');
  });
});
