let lastCopied = '';

/** What was last copied inside the app: Paste uses it when the system clipboard cannot be read (iOS asks every time). */
export function lastCopiedText(): string {
  return lastCopied;
}

/** Copies text; falls back to a selection + execCommand, which iOS Safari still allows inside a tap. */
export async function copyText(text: string): Promise<boolean> {
  lastCopied = text;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* denied or unavailable: try the older way */
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
  document.body.appendChild(area);
  area.select();
  area.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

/** The system clipboard, or null when it cannot be read or is empty (iOS only allows it from a tap, and the user may refuse). */
export async function pasteText(): Promise<string | null> {
  try {
    return (await navigator.clipboard.readText()) || null;
  } catch {
    return null;
  }
}
