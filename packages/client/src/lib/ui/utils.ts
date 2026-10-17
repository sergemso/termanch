import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// The type scale in app.css (@theme) is custom: without this, twMerge reads text-title as a colour and drops it
// when a colour follows (text-title text-warn).
const twMerge = extendTailwindMerge({ extend: { classGroups: { 'font-size': [{ text: ['xs', 'sm', 'base', 'input', 'title'] }] } } });

/** Joins class names and lets the last Tailwind utility win (the shadcn-svelte helper). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
