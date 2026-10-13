export const FONT_FAMILY = '"JetBrains Mono", "Fira Code", "Monaco", "Menlo", monospace';

export const THEME = {
  background: '#0d1117',
  foreground: '#e6edf3',
  cursor: '#58a6ff',
  cursorAccent: '#0d1117',
  selectionBackground: 'rgba(88, 166, 255, 0.3)',
  black: '#161b22',
  red: '#f85149',
  green: '#3fb950',
  yellow: '#d29922',
  blue: '#58a6ff',
  magenta: '#a371f7',
  cyan: '#39c5cf',
  white: '#e6edf3',
  brightBlack: '#484f58',
  brightRed: '#ff7b72',
  brightGreen: '#56d364',
  brightYellow: '#e3b341',
  brightBlue: '#79b8ff',
  brightMagenta: '#b490f7',
  brightCyan: '#56d4dd',
  brightWhite: '#ffffff',
} as const;

/** Match the app theme while retaining the terminal's ANSI palette. */
export function terminalTheme(light: boolean) {
  return light ? { ...THEME, background: '#ffffff', foreground: '#1f2328', cursor: '#0969da', cursorAccent: '#ffffff', black: '#1f2328', white: '#59636e', brightWhite: '#1f2328', selectionBackground: 'rgba(9, 105, 218, 0.2)' } : THEME;
}
