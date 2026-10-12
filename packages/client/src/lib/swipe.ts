// iOS swipe typing and autocorrect (plan X.1/X.2, fact 0027): the keyboard inserts a whole word with
// `insertText`, which xterm forwards. When the user then picks another suggestion, iOS fires
// `beforeinput` with `inputType: "insertReplacementText"`, the old word still selected in xterm's hidden
// textarea (e.g. value "hello", selection 0-5, data "he'll"). xterm ignores that event, so the terminal kept
// the old word and only the following space arrived. We turn it into what a person would have typed:
// delete the old word, then type the replacement.

const DEL = '\x7f';

/** Bytes for the terminal: one DEL per code point of the replaced text, then the replacement. */
export function replacementKeys(value: string, start: number, end: number, data: string): string {
  const removed = [...value.slice(Math.min(start, end), Math.max(start, end))].length;
  return DEL.repeat(removed) + data;
}

/** The text of a replacement event, or null when the event is not one we handle. */
export function replacementData(e: Pick<InputEvent, 'inputType' | 'data' | 'isComposing' | 'dataTransfer'>): string | null {
  if (e.inputType !== 'insertReplacementText' || e.isComposing) return null; // composition has its own path in xterm
  const data = e.data ?? e.dataTransfer?.getData('text/plain') ?? '';
  return data || null;
}
