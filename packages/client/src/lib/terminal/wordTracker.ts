// Remembers the word being typed at the terminal's prompt, from the bytes we send. iOS decides what a tapped
// suggestion replaces from the text in the hidden input, which xterm keeps empty or stale; when the keyboard
// offers "утром" for a typed "у", iOS inserts the whole suggestion as new text (captured on an iPhone, fact 0027)
// and the typed letters stay behind. Knowing the word lets us delete it first.

const BACKSPACE = new Set(['\x7f', '\b']);

export class WordTracker {
  private word: string[] = [];

  get current(): string {
    return this.word.join('');
  }

  /** Feed every byte string sent to the terminal, in order. */
  feed(data: string): void {
    if (data.startsWith('\x1b')) return this.reset(); // cursor keys and other escape sequences move the cursor
    for (const ch of data) {
      if (BACKSPACE.has(ch)) this.word.pop();
      else if (ch <= ' ') this.reset(); // space, Enter, Tab and other control characters end the word
      else this.word.push(ch);
    }
  }

  reset(): void {
    this.word = [];
  }

  /**
   * How many characters to delete before typing `incoming`, when it is a suggestion that completes the word being
   * typed ("утро" for "у"): the length of the word, else 0. Case is ignored ("Утром" completes "у").
   */
  completionPrefix(incoming: string): number {
    const typed = this.word.length;
    if (typed === 0 || [...incoming].length <= typed) return 0;
    return incoming.toLowerCase().startsWith(this.current.toLowerCase()) ? typed : 0;
  }
}
