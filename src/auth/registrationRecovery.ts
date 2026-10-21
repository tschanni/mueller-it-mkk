import type { RegistrationInput } from './client';

export type TransferState = 'LOADING' | 'SUCCESS' | 'ERROR' | 'UNCERTAIN';
export interface RegistrationOutcome { state: TransferState; message?: string }
export interface RegistrationRecovery {
  start(input: RegistrationInput, signal: AbortSignal): Promise<RegistrationOutcome>;
  check(signal: AbortSignal): Promise<RegistrationOutcome>;
  canCheck(): boolean;
  dispose(): void;
}
const accepted: RegistrationOutcome = { state: 'SUCCESS' };
const uncertain: RegistrationOutcome = { state: 'UNCERTAIN' };
const rejected: RegistrationOutcome = { state: 'ERROR', message: 'Die Registrierung konnte nicht angenommen werden. Bitte prüfe deine Angaben oder versuche es später erneut.' };

export function registrationKey(): string {
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
  return `v1.${Math.floor(Date.now() / 1000)}.${nonce}`;
}
export function retryDelay(headers: Headers): number {
  return Math.max(0, ...['Retry-After', 'X-Retry-After'].map(name => {
    const value = headers.get(name);
    if (!value) return 0;
    const delay = /^\d+(?:\.\d+)?$/.test(value) ? Number(value) * 1000 : Date.parse(value) - Date.now();
    return Number.isFinite(delay) ? Math.max(0, delay) : 0;
  }));
}
export function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(new Error('Cancelled')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}
export async function timedRequest<T>(read: (signal: AbortSignal) => Promise<T>, parent: AbortSignal, ms = 15000): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  parent.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, ms);
  try {
    return await new Promise<T>((resolve, reject) => {
      controller.signal.addEventListener('abort', () => reject(new Error('Cancelled')), { once: true });
      if (parent.aborted) abort();
      if (!controller.signal.aborted) void read(controller.signal).then(resolve, reject);
    });
  } finally { clearTimeout(timer); parent.removeEventListener('abort', abort); }
}

/** One receipt per explicit submission. No persistence, logs, or global retries. */
export function createRegistrationRecovery(apiBase: string, fetcher: typeof fetch): RegistrationRecovery {
  let key: string | null = null;
  let body: string | null = null;
  let attempts = 0;
  let deadline = 0;
  let notBefore = 0;
  let running = false;
  let terminal = false;
  let disposed = false;
  let started = false;
  const canCheck = () => !!key && !terminal && !disposed && attempts < 6 && Date.now() < deadline;
  async function execute(signal: AbortSignal, first: boolean): Promise<RegistrationOutcome> {
    if (running || disposed || terminal || !key) return uncertain;
    running = true;
    let method = first ? 'POST' : 'GET';
    let outcome = uncertain;
    try {
      while (attempts < 6 && Date.now() < deadline && !signal.aborted && !disposed) {
        const jitter = crypto.getRandomValues(new Uint8Array(1))[0] % 251;
        const delay = Math.max(attempts === 0 ? 0 : 1000 * 2 ** (attempts - 1), notBefore - Date.now()) + jitter;
        if (Date.now() + delay >= deadline) break;
        await pause(delay, signal);
        if (signal.aborted || disposed || !key || Date.now() >= deadline) break;
        const receipt = key;
        const requestMethod = method;
        const payload = method === 'POST' ? body : null;
        if (method === 'POST' && !payload) break;
        attempts++;
        try {
          const { response, data } = await timedRequest(async requestSignal => {
            const response = await fetcher(`${apiBase}/auth-recovery/${requestMethod === 'POST' ? 'registrations' : 'registration'}`, {
              method: requestMethod, signal: requestSignal, credentials: 'include', cache: 'no-store', redirect: 'error',
              headers: { Accept: 'application/json', 'Idempotency-Key': receipt, ...(payload ? { 'Content-Type': 'application/json' } : {}) },
              ...(payload ? { body: payload } : {}),
            });
            const data = await response.json().catch(() => null);
            return { response, data };
          }, signal, Math.min(15000, deadline - Date.now()));
          if (signal.aborted || disposed) break;
          notBefore = Date.now() + retryDelay(response.headers);
          if (response.status === 200 && data?.state === 'SUCCEEDED' && data.code === 'REGISTRATION_ACCEPTED') { outcome = accepted; terminal = true; break; }
          if (response.status === 202 && data?.state === 'UNCERTAIN' && data.code === 'REGISTRATION_UNCERTAIN') break;
          if ([400, 403, 409, 410].includes(response.status)) { outcome = rejected; terminal = true; break; }
          if (response.status === 429 && data?.state === 'RATE_LIMITED' && data.code === 'AUTH_RATE_LIMITED') {
            // Never replay before the known limit expires; use a conservative
            // minute if a proxy removed the documented retry header.
            if (!retryDelay(response.headers)) notBefore = Date.now() + 60000;
            method = body ? 'POST' : 'GET';
          } else if (response.status === 404 && data?.code === 'REGISTRATION_NOT_FOUND') {
            method = body ? 'POST' : 'GET';
          } else {
            if (response.status === 429 && !retryDelay(response.headers)) notBefore = Date.now() + 60000;
            method = 'GET';
          }
        } catch { method = 'GET'; }
        // An explicit check may only read once; it never resumes a POST.
        if (!first) break;
      }
    } catch { /* Cancelled or unable to wait: outcome remains uncertain. */ }
    finally {
      body = null; running = false;
      if (terminal || disposed || attempts >= 6 || Date.now() >= deadline || notBefore >= deadline) key = null;
    }
    return outcome;
  }
  return {
    async start(input, signal) {
      if (started || running || terminal || disposed) return uncertain;
      started = true;
      try { key = registrationKey(); } catch { return { state: 'ERROR', message: 'Die sichere Registrierung ist in diesem Browser nicht verfügbar.' }; }
      deadline = Date.now() + 120000;
      body = JSON.stringify({ name: input.name, email: input.email, password: input.password });
      return execute(signal, true);
    },
    check: signal => canCheck() ? execute(signal, false) : Promise.resolve(uncertain),
    canCheck,
    dispose() { disposed = true; key = null; body = null; },
  };
}
