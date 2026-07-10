import { computeHa1 } from './crypto';
import { fetchAuthChallenge, KeeneticClient } from './client';
import { ensureOriginStripRule } from './origin-fix';
import { normalizeOrigin, routerSettings, type RouterSettings } from '../settings';

/**
 * Full first-time connection flow: request host permission, probe the router,
 * derive ha1 and verify the credentials, then persist the settings.
 *
 * Must be called from a user gesture (button click): permissions.request()
 * is rejected outside one, which is why it runs before any fetch.
 */
export async function connectRouter(
  addressInput: string,
  login: string,
  password: string,
): Promise<RouterSettings> {
  const origin = normalizeOrigin(addressInput);

  const granted = await browser.permissions.request({ origins: [`${origin}/*`] });
  if (!granted) throw new Error('Access to the router address was declined');

  await ensureOriginStripRule(origin);

  let auth = await fetchAuthChallenge(origin);
  if (auth === null) {
    // A session from an earlier configuration is still alive; drop it —
    // the challenge response is the only place the realm is exposed.
    await fetch(`${origin}/auth`, { method: 'DELETE', credentials: 'include' });
    auth = await fetchAuthChallenge(origin);
    if (auth === null) throw new Error('Could not obtain an auth challenge');
  }

  const ha1 = computeHa1(login, auth.realm, password);
  const client = new KeeneticClient({ origin, login, ha1 });
  await client.authenticate();

  const settings: RouterSettings = { origin, login, ha1, realm: auth.realm };
  await routerSettings.setValue(settings);
  return settings;
}
