// Voice input (plan R53): the browser's own speech recognizer, nothing of ours in between. No audio goes to our
// servers and no paid speech service is used; the browser vendor may process the audio (privacy notice, R08).

/** The part of the Web Speech API we use. */
export interface RecognizerResult {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
}
export interface RecognizerEvent {
  readonly resultIndex: number;
  readonly results: { readonly length: number; readonly [i: number]: RecognizerResult };
}
export interface Recognizer {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognizerEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
export type RecognizerFactory = () => Recognizer;

/** The recognizer the browser offers, or null when there is none (the key is then hidden). */
export function recognizerFactory(scope: Record<string, unknown> = globalThis as Record<string, unknown>): RecognizerFactory | null {
  const ctor = (scope.SpeechRecognition ?? scope.webkitSpeechRecognition) as (new () => Recognizer) | undefined;
  return ctor ? () => new ctor() : null;
}

/** What a recognizer event adds: text to type now, and the words still being guessed. */
export interface Mapped {
  /** Final text, spaced so that it follows whatever was typed before it in this session. */
  typed: string;
  interim: string;
}

/**
 * Maps one event to text. Final results are typed once, trimmed, with one space before every phrase after the first
 * (browsers disagree on whether they supply it). Interim results are only shown. `started` says whether this
 * session has typed anything yet.
 */
export function mapResults(e: RecognizerEvent, started: boolean): Mapped {
  let typed = '';
  let interim = '';
  for (let i = e.resultIndex; i < e.results.length; i++) {
    const r = e.results[i];
    const text = r[0].transcript.trim();
    if (!text) continue;
    if (r.isFinal) {
      typed += (started || typed ? ' ' : '') + text;
    } else {
      interim += (interim ? ' ' : '') + text;
    }
  }
  return { typed, interim };
}

/** Why a session ended with an error, in words for the person; null when it is not worth saying. */
export function errorMessage(code: string): string | null {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone is blocked. Allow it in the browser settings to dictate.';
    case 'audio-capture':
      return 'No microphone found.';
    case 'network':
      return 'Speech recognition needs a connection in this browser.';
    case 'language-not-supported':
      return 'This language is not supported for dictation.';
    case 'no-speech':
    case 'aborted':
      return null;
    default:
      return `Dictation failed (${code}).`;
  }
}

/** The dictation language the person chose: `auto` follows the script of what was typed. */
export type VoiceLang = 'auto' | 'en' | 'ru';
const LANGS: VoiceLang[] = ['auto', 'en', 'ru'];

export function nextVoiceLang(l: VoiceLang): VoiceLang {
  return LANGS[(LANGS.indexOf(l) + 1) % LANGS.length];
}

/** Reads a stored choice; anything else is `auto`. */
export function parseVoiceLang(v: string | null): VoiceLang {
  return LANGS.includes(v as VoiceLang) ? (v as VoiceLang) : 'auto';
}

/**
 * The recognizer takes one language per session and cannot detect it, and the web cannot read the keyboard layout on
 * iOS. So: the person's choice, else the script of the text just typed (Latin -> English, Cyrillic -> Russian), else
 * the browser's language.
 */
export function pickLanguage(choice: VoiceLang, script: 'latin' | 'cyrillic' | null, browserLang: string): string {
  if (choice === 'en') return 'en-US';
  if (choice === 'ru') return 'ru-RU';
  if (script === 'latin') return 'en-US';
  if (script === 'cyrillic') return 'ru-RU';
  return browserLang || 'en-US';
}

export interface VoiceHandlers {
  /** Final text, to type as if typed (never followed by Enter). */
  onText: (text: string) => void;
  /** Words still being guessed; empty when nothing is. */
  onInterim: (text: string) => void;
  /** Listening started or stopped. */
  onState: (listening: boolean) => void;
  onError: (message: string) => void;
}

/** One dictation key: tap to start, tap to stop. */
export class Voice {
  private rec: Recognizer | null = null;
  private started = false;

  constructor(
    private readonly make: RecognizerFactory,
    private readonly lang: () => string,
    private readonly on: VoiceHandlers,
  ) {}

  get listening(): boolean {
    return this.rec !== null;
  }

  toggle(): void {
    if (this.rec) this.stop();
    else this.start();
  }

  start(): void {
    if (this.rec) return;
    const rec = this.make();
    rec.lang = this.lang();
    rec.continuous = true;
    rec.interimResults = true;
    this.started = false;
    rec.onresult = (e) => {
      if (this.rec !== rec) return;
      const m = mapResults(e, this.started);
      if (m.typed) {
        this.started = true;
        this.on.onText(m.typed);
      }
      this.on.onInterim(m.interim);
    };
    rec.onerror = (e) => {
      const msg = errorMessage(e.error);
      if (msg) this.on.onError(msg);
    };
    rec.onend = () => {
      if (this.rec !== rec) return;
      this.rec = null;
      this.on.onInterim('');
      this.on.onState(false);
    };
    this.rec = rec;
    try {
      rec.start();
      this.on.onState(true);
    } catch {
      this.rec = null;
      this.on.onError('Dictation could not start.');
    }
  }

  /** Stops listening; a phrase the recognizer is about to finalize still arrives before `onend`. */
  stop(): void {
    this.rec?.stop();
  }
}
