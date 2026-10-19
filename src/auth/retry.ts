import { AuthError } from './client';

export const transientAuthError = (error: unknown) => error instanceof AuthError && ['network', 'server'].includes(error.code);

/** Only retry reads. The caller supplies the overall deadline through signal. */
export async function retryAuthRead<T>(read: () => Promise<T>, signal: AbortSignal): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    if (signal.aborted) throw new AuthError('network');
    try { return await read(); } catch (error) {
      if (!transientAuthError(error) || attempt >= 2 || signal.aborted) throw error;
      await new Promise<void>((resolve, reject) => {
        const abort = () => { clearTimeout(timer); reject(new AuthError('network')); };
        const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 750 * 2 ** attempt);
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
      });
    }
  }
}
