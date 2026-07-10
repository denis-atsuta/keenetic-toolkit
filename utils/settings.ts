export interface RouterSettings {
  /** Normalized origin, e.g. "http://192.168.1.1" */
  origin: string;
  login: string;
  /** Derived credential, see computeHa1. The raw password is never stored. */
  ha1: string;
  /** Device model from X-NDM-Realm, shown in the UI. */
  realm: string;
}

export const routerSettings = storage.defineItem<RouterSettings | null>('local:routerSettings', {
  fallback: null,
});

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
