export type SheetHeight = 'peek' | 'half' | 'full';
export const HEIGHTS: SheetHeight[] = ['peek', 'half', 'full'];
export function sheetHeight(height: SheetHeight, available: number): number {
  const space = Math.max(0, available);
  return Math.min(space, height === 'peek' ? 96 : height === 'half' ? Math.max(96, space / 2) : space);
}
export function snapHeight(pixels: number, available: number): SheetHeight {
  return HEIGHTS.reduce((best, next) => Math.abs(sheetHeight(next, available) - pixels) < Math.abs(sheetHeight(best, available) - pixels) ? next : best);
}
