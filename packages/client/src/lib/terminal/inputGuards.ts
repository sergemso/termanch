// Small fixes for the terminal's hidden input on phones.

/** The keyboard's return key says "return" rather than "OK/Done". */
export function setEnterKeyHint(area: HTMLTextAreaElement): void {
  area.setAttribute('enterkeyhint', 'enter');
}
