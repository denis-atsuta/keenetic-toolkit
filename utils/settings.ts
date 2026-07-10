/** An active connection to the router (held in memory while in use). */
export interface RouterSettings {
  /** Normalized origin, e.g. "http://192.168.1.1" */
  origin: string;
  login: string;
  /** Derived credential, see computeHa1. Never the raw password. */
  ha1: string;
  /** Device model from X-NDM-Realm, shown in the UI. */
  realm: string;
}

/** Non-secret part of a connection, always safe to keep on disk. */
export interface RouterProfile {
  origin: string;
  login: string;
  realm: string;
  /** Whether the user opted to persist ha1 on disk. */
  remember: boolean;
}

// The secret (ha1) lives in memory by default (session) so it never touches
// disk; it is mirrored to local storage only when the user opts in with
// "remember". The non-secret profile is always kept on disk so the connect
// form can be prefilled after a browser restart.
const profileStore = storage.defineItem<RouterProfile | null>('local:routerProfile', {
  fallback: null,
});
const sessionHa1 = storage.defineItem<string | null>('session:ha1', { fallback: null });
const persistedHa1 = storage.defineItem<string | null>('local:ha1', { fallback: null });

export type ConnectionState =
  | { status: 'none' }
  | { status: 'connected'; settings: RouterSettings }
  | { status: 'locked'; profile: RouterProfile };

export async function saveConnection(settings: RouterSettings, remember: boolean): Promise<void> {
  await profileStore.setValue({
    origin: settings.origin,
    login: settings.login,
    realm: settings.realm,
    remember,
  });
  await sessionHa1.setValue(settings.ha1);
  await persistedHa1.setValue(remember ? settings.ha1 : null);
}

/**
 * Resolves the current connection: connected when ha1 is available (from the
 * in-memory session, or hydrated from disk when "remember" is on), locked
 * when only the non-secret profile survives (memory cleared on restart), or
 * none on a fresh install.
 */
export async function loadConnection(): Promise<ConnectionState> {
  const profile = await profileStore.getValue();
  if (!profile) return { status: 'none' };

  let ha1 = await sessionHa1.getValue();
  if (!ha1 && profile.remember) {
    ha1 = await persistedHa1.getValue();
    if (ha1) await sessionHa1.setValue(ha1);
  }
  if (ha1) {
    return {
      status: 'connected',
      settings: { origin: profile.origin, login: profile.login, realm: profile.realm, ha1 },
    };
  }
  return { status: 'locked', profile };
}

export async function clearConnection(): Promise<void> {
  await profileStore.setValue(null);
  await sessionHa1.setValue(null);
  await persistedHa1.setValue(null);
}

export async function getRouterOrigin(): Promise<string | null> {
  const profile = await profileStore.getValue();
  return profile?.origin ?? null;
}

/**
 * Turns user input like "192.168.1.1", "my.keenetic.net/" or
 * "http://host:8080" into a clean http origin.
 */
export function normalizeOrigin(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Router address is empty');
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  return new URL(withScheme).origin;
}
