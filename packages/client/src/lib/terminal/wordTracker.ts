// Remembers the word being typed at the terminal's prompt, from the bytes we send. iOS decides what a tapped
// suggestion replaces from the text in the hidden input, which xterm keeps empty or stale; when the keyboard
// offers "утром" for a typed "у", iOS inserts the whole suggestion as new text (captured on an iPhone, fact 0027)
// and the typed letters stay behind. Knowing the word lets us delete it first.

const BACKSPACE = new Set(['\x7f', '\b']);

/** One word that arrived in a single piece, with the spaces the keyboard put around it (`hello `, ` hello`). */
const WHOLE_WORD = /^\s*(\S+?)(\s*)$/u;

/** A word the keyboard inserted whole (swipe typing, a tapped suggestion), and the spaces it left after it. */
interface Inserted {
  chars: string[];
  trailing: number;
}

export class WordTracker {
  private word: string[] = [];
  private inserted: Inserted | null = null;

  get current(): string {
    return this.word.join('');
  }

  /**
   * How many backspaces one Backspace press stands for. A word that came in whole is taken back whole, but a
   * space the keyboard added after it goes first and alone, so a comma or full stop can follow the word
   * ("hello " -> Backspace -> "hello" -> type "," ; a second Backspace instead removes "hello").
   */
  backspaceCount(): number {
    const w = this.inserted;
    if (!w) return 1;
    return w.trailing > 0 ? 1 : w.chars.length;
  }

  /** Forget that the last word came in whole (a paste, or anything that is not the keyboard's own insertion). */
  clearInsert(): void {
    this.inserted = null;
  }

  /** Feed every byte string sent to the terminal, in order. */
  feed(data: string): void {
    if (data.startsWith('\x1b')) return this.reset(); // cursor keys and other escape sequences move the cursor
    let rest = '';
    for (const ch of data) {
      if (BACKSPACE.has(ch) && !rest) this.backspace();
      else {
        rest += ch;
        if (ch <= ' ' || BACKSPACE.has(ch)) this.reset(); // space, Enter, Tab and other control characters end the word
        else this.word.push(ch);
      }
    }
    if (rest) this.noteInsert(rest);
  }

  private backspace(): void {
    const w = this.inserted;
    if (!w) {
      this.word.pop();
      return;
    }
    if (w.trailing > 0) {
      w.trailing--;
      if (w.trailing === 0) this.word = [...w.chars]; // the cursor is back at the end of the word
    } else {
      this.word.pop();
      w.chars.pop();
      if (!w.chars.length) this.inserted = null;
    }
  }

  /** `text` is what followed any backspaces of one send: remember it when it is a single word of two or more characters. */
  private noteInsert(text: string): void {
    const m = WHOLE_WORD.exec(text);
    this.inserted = m && [...m[1]].length > 1 && ![...m[1]].some((c) => c < ' ' || BACKSPACE.has(c)) ? { chars: [...m[1]], trailing: m[2].length } : null;
    if (this.inserted && this.inserted.trailing > 0) this.word = [];
  }

  reset(): void {
    this.word = [];
    this.inserted = null;
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
