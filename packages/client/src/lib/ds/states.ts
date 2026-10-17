/** The four fleet states (decision 0100) plus idle. Colour never carries a state alone (DR9): each has a word and a glyph. */
export type FleetState = 'needs-you' | 'working' | 'failed' | 'finished' | 'idle';

export const STATES: Record<FleetState, { label: string; glyph: string; text: string; bg: string; ring: string }> = {
  'needs-you': { label: 'Needs you', glyph: '!', text: 'text-warn', bg: 'bg-warn/15', ring: 'ring-warn' },
  working: { label: 'Working', glyph: '●', text: 'text-info', bg: 'bg-info/15', ring: 'ring-info' },
  failed: { label: 'Failed', glyph: '✕', text: 'text-bad', bg: 'bg-bad/15', ring: 'ring-bad' },
  finished: { label: 'Finished', glyph: '✓', text: 'text-ok', bg: 'bg-ok/15', ring: 'ring-ok' },
  idle: { label: 'Idle', glyph: '–', text: 'text-muted', bg: 'bg-raised', ring: 'ring-line' },
};
