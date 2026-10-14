// Small fixes for the terminal's hidden input on phones.

/** The keyboard's return key says "return" rather than "OK/Done". */
export function setEnterKeyHint(area: HTMLTextAreaElement): void {
  area.setAttribute('enterkeyhint', 'enter');
}

/**
 * Colour-query answers (OSC 10/11/12) that xterm generates by itself. tmux relays an application's query to
 * every attached client, so with the session open in two places the second answer reaches the shell as typed
 * text. tmux answers these queries for the pane on its own, so the browser's answer is dropped.
 */
// eslint-disable-next-line no-control-regex
const COLOR_REPLY = /\x1b\](?:10|11|12);[^\x07\x1b]*(?:\x07|\x1b\\)/g;

export function dropColorReplies(data: string): string {
  return data.replace(COLOR_REPLY, '');
}
