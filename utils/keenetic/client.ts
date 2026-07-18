import { challengeResponse } from './crypto';

/** The router rejected the credentials — the user must re-enter them. */
export class KeeneticAuthError extends Error {
  constructor(message = 'Router rejected the credentials') {
    super(message);
    this.name = 'KeeneticAuthError';
  }
}

/** Any other unexpected response from the router. */
export class KeeneticApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'KeeneticApiError';
  }
}

export interface AuthChallenge {
  realm: string;
  challenge: string;
}

/** Recursively collects `{"status": "error", "message": ...}` entries. */
export function collectRciErrors(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectRciErrors);
  if (value === null || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  if (record.status === 'error') {
    return [typeof record.message === 'string' ? record.message : 'RCI operation failed'];
  }
  return Object.values(record).flatMap(collectRciErrors);
}

/**
 * Probes `origin` for a Keenetic router.
 *
 * Returns the current auth challenge, or null if a previous session is still
 * alive. Throws KeeneticApiError if the endpoint does not look like Keenetic.
 */
export async function fetchAuthChallenge(origin: string): Promise<AuthChallenge | null> {
  const res = await fetch(`${origin}/auth`, { credentials: 'include' });
  if (res.ok) return null;
  if (res.status !== 401) {
    throw new KeeneticApiError(`Unexpected /auth response: ${res.status}`, res.status);
  }
  const realm = res.headers.get('X-NDM-Realm');
  const challenge = res.headers.get('X-NDM-Challenge');
  if (!realm || !challenge) {
    throw new KeeneticApiError('No Keenetic auth challenge at this address');
  }
  return { realm, challenge };
}

export interface KeeneticCredentials {
  /** e.g. "http://192.168.227.1" or "http://my.keenetic.net" */
  origin: string;
  login: string;
  /** md5("login:realm:password"), see computeHa1 */
  ha1: string;
}

/**
 * Minimal RCI client with challenge-response auth.
 *
 * The session cookie lives ~5 minutes (sliding), so every request retries
 * once through a fresh handshake on 401 instead of keeping the session alive.
 */
export class KeeneticClient {
  constructor(private readonly creds: KeeneticCredentials) {}

  /** Performs the challenge handshake. No-op if the session is still alive. */
  async authenticate(): Promise<void> {
    const auth = await fetchAuthChallenge(this.creds.origin);
    if (auth === null) return;

    const res = await fetch(`${this.creds.origin}/auth`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login: this.creds.login,
        password: challengeResponse(auth.challenge, this.creds.ha1),
      }),
    });
    if (res.status === 401) throw new KeeneticAuthError();
    if (!res.ok) {
      throw new KeeneticApiError(`Auth handshake failed: ${res.status}`, res.status);
    }
  }

  /**
   * Executes several RCI operations in order via POST /rci/ — used to pair
   * a config change with `system configuration save` in one round-trip.
   *
   * Failed operations still answer HTTP 200 with error entries buried in
   * the body (e.g. `host "..." is unregistered`), so the response is
   * scanned and the first error is thrown.
   */
  async rciBatch(operations: unknown[]): Promise<unknown[]> {
    const result = await this.rci<unknown[]>('/', operations);
    const errors = collectRciErrors(result);
    if (errors.length > 0) throw new KeeneticApiError(errors[0]);
    return result;
  }

  /** GET /rci/<path> (or POST when `body` is given), re-authenticating on 401. */
  async rci<T>(path: string, body?: unknown): Promise<T> {
    const exec = () =>
      fetch(`${this.creds.origin}/rci${path}`, {
        credentials: 'include',
        ...(body !== undefined && {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
      });

    let res = await exec();
    if (res.status === 401) {
      await this.authenticate();
      res = await exec();
    }
    if (!res.ok) {
      throw new KeeneticApiError(`RCI ${path} failed: ${res.status}`, res.status);
    }
    return res.json() as Promise<T>;
  }
}
