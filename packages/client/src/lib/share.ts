// Send a saved server to another of the owner's devices. The link carries only the server's public id
// (`#server=<id>`, handled by App.svelte): the other device still has to sign in with the same GitHub account,
// and the server accepts only its owner (DECISION-0053), so the link is useless to anyone else.
import { copyText } from './clipboard';

export type SendResult = 'shared' | 'copied' | 'cancelled' | 'failed';

export interface SendDeps {
  /** `navigator.share`, absent on most desktop browsers. */
  share?: (data: { title: string; text: string; url: string }) => Promise<void>;
  copy: (text: string) => Promise<boolean>;
}

const realDeps = (): SendDeps => ({
  share: typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? (d) => navigator.share(d) : undefined,
  copy: copyText,
});

/** Opens the system share sheet when there is one (AirDrop, Messages, Mail on an iPhone), else copies the link. */
export async function sendServerLink(link: string, name: string, deps: SendDeps = realDeps()): Promise<SendResult> {
  if (deps.share) {
    try {
      await deps.share({ title: 'Termenbox', text: `Open ${name || 'my server'} in Termenbox`, url: link });
      return 'shared';
    } catch (e) {
      // The user closing the sheet is not an error; any other failure falls through to copying.
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }
  return (await deps.copy(link)) ? 'copied' : 'failed';
}
