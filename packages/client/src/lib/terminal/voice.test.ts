import { describe, expect, it, vi } from 'vitest';
import { errorMessage, mapResults, nextVoiceLang, parseVoiceLang, pickLanguage, recognizerFactory, Voice, type Recognizer, type RecognizerEvent } from './voice';

const ev = (resultIndex: number, ...rs: [string, boolean][]): RecognizerEvent => ({
  resultIndex,
  results: Object.assign(
    rs.map(([transcript, isFinal]) => ({ isFinal, 0: { transcript } })),
    {},
  ),
});

describe('mapResults', () => {
  it('shows interim text and types nothing for it', () => {
    expect(mapResults(ev(0, ['hello wor', false]), false)).toEqual({ typed: '', interim: 'hello wor' });
  });

  it('types a final result trimmed, without a leading space for the first phrase', () => {
    expect(mapResults(ev(0, [' hello world', true]), false)).toEqual({ typed: 'hello world', interim: '' });
  });

  it('puts one space before later phrases, whether or not the browser supplied it', () => {
    expect(mapResults(ev(0, ['next one', true]), true).typed).toBe(' next one');
    expect(mapResults(ev(0, [' next one', true]), true).typed).toBe(' next one');
  });

  it('reads only from resultIndex on, and splits final from interim', () => {
    const e = ev(1, ['old', true], ['and then', true], ['some', false]);
    expect(mapResults(e, false)).toEqual({ typed: 'and then', interim: 'some' });
  });

  it('works for Russian', () => {
    expect(mapResults(ev(0, ['привет мир', true]), false).typed).toBe('привет мир');
  });

  it('ignores empty results', () => {
    expect(mapResults(ev(0, ['  ', true]), false)).toEqual({ typed: '', interim: '' });
  });
});

describe('errorMessage', () => {
  it('explains a blocked microphone and stays quiet on silence', () => {
    expect(errorMessage('not-allowed')).toMatch(/blocked/);
    expect(errorMessage('no-speech')).toBeNull();
    expect(errorMessage('weird')).toMatch(/weird/);
  });
});

describe('recognizerFactory', () => {
  it('is null when the browser has no recognizer, so the key is hidden', () => {
    expect(recognizerFactory({})).toBeNull();
  });
  it('uses the prefixed constructor', () => {
    class R {}
    expect(recognizerFactory({ webkitSpeechRecognition: R })?.()).toBeInstanceOf(R);
  });
});

function fake() {
  const rec: Recognizer = {
    lang: '',
    continuous: false,
    interimResults: false,
    onresult: null,
    onerror: null,
    onend: null,
    start: vi.fn(),
    stop: vi.fn(() => rec.onend?.()),
  };
  return rec;
}

describe('Voice', () => {
  const setup = () => {
    const rec = fake();
    const on = { onText: vi.fn(), onInterim: vi.fn(), onState: vi.fn(), onError: vi.fn() };
    const voice = new Voice(() => rec, () => 'ru-RU', on);
    return { rec, on, voice };
  };

  it('listens in the given language, continuously, with interim results', () => {
    const { rec, on, voice } = setup();
    voice.toggle();
    expect(rec.lang).toBe('ru-RU');
    expect(rec.continuous && rec.interimResults).toBe(true);
    expect(rec.start).toHaveBeenCalled();
    expect(on.onState).toHaveBeenLastCalledWith(true);
  });

  it('types final phrases with a space between them, and clears the interim line at the end', () => {
    const { rec, on, voice } = setup();
    voice.toggle();
    rec.onresult?.(ev(0, ['one two', false]));
    expect(on.onInterim).toHaveBeenLastCalledWith('one two');
    rec.onresult?.(ev(0, ['one two', true]));
    rec.onresult?.(ev(1, ['one two', true], ['three', true]));
    expect(on.onText.mock.calls).toEqual([['one two'], [' three']]);
    voice.toggle();
    expect(voice.listening).toBe(false);
    expect(on.onInterim).toHaveBeenLastCalledWith('');
    expect(on.onState).toHaveBeenLastCalledWith(false);
  });

  it('starts a new session without a leading space', () => {
    const { rec, on, voice } = setup();
    voice.toggle();
    rec.onresult?.(ev(0, ['first', true]));
    voice.toggle();
    voice.toggle();
    rec.onresult?.(ev(0, ['second', true]));
    expect(on.onText.mock.calls).toEqual([['first'], ['second']]);
  });

  it('reports a denied microphone', () => {
    const { rec, on, voice } = setup();
    voice.toggle();
    rec.onerror?.({ error: 'not-allowed' });
    expect(on.onError).toHaveBeenCalledWith(expect.stringMatching(/blocked/));
  });

  it('reports a recognizer that cannot start', () => {
    const { rec, on, voice } = setup();
    (rec.start as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('busy');
    });
    voice.toggle();
    expect(voice.listening).toBe(false);
    expect(on.onError).toHaveBeenCalled();
  });
});

describe('dictation language', () => {
  it('follows the script of the typed text when the choice is auto', () => {
    expect(pickLanguage('auto', 'latin', 'ru-RU')).toBe('en-US');
    expect(pickLanguage('auto', 'cyrillic', 'en-US')).toBe('ru-RU');
  });

  it('falls back to the browser language, then English', () => {
    expect(pickLanguage('auto', null, 'ru-RU')).toBe('ru-RU');
    expect(pickLanguage('auto', null, '')).toBe('en-US');
  });

  it('a forced language wins over what was typed', () => {
    expect(pickLanguage('en', 'cyrillic', 'ru-RU')).toBe('en-US');
    expect(pickLanguage('ru', 'latin', 'en-US')).toBe('ru-RU');
  });

  it('cycles auto -> en -> ru -> auto and reads stored values safely', () => {
    expect(nextVoiceLang('auto')).toBe('en');
    expect(nextVoiceLang('en')).toBe('ru');
    expect(nextVoiceLang('ru')).toBe('auto');
    expect(parseVoiceLang('ru')).toBe('ru');
    expect(parseVoiceLang('xx')).toBe('auto');
    expect(parseVoiceLang(null)).toBe('auto');
  });
});
