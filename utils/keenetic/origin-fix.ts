const RULE_ID = 1;

/**
 * The router's CSRF protection answers 403 to any POST whose Origin header
 * it does not recognize, and chrome-extension://... origins are never
 * recognized. fetch() cannot omit Origin (forbidden header), so a DNR
 * session rule strips it from every request to the router instead.
 *
 * Session rules do not survive a browser restart — the background script
 * re-registers the rule on startup, and callers re-ensure it before use.
 */
export async function ensureOriginStripRule(origin: string): Promise<void> {
  await browser.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [RULE_ID],
    addRules: [
      {
        id: RULE_ID,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [{ header: 'Origin', operation: 'remove' }],
        },
        condition: {
          urlFilter: `${origin}/`,
          resourceTypes: ['xmlhttprequest'],
        },
      },
    ],
  });
}

/** Drops the Origin-strip rule, e.g. on logout. */
export async function clearOriginStripRule(): Promise<void> {
  await browser.declarativeNetRequest.updateSessionRules({ removeRuleIds: [RULE_ID] });
}
