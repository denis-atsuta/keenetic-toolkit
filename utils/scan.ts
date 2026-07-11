/**
 * Page scan: collect the hostnames the active tab loaded resources from,
 * so they can be added to a routing address list.
 */
import { getDomain } from 'tldts-experimental';

export interface ScanResult {
  /** Hostname of the scanned page itself. */
  pageHost: string;
  /** Unique hostnames the page loaded (pageHost first, rest sorted). */
  hosts: string[];
  /**
   * False when the page could not be inspected (typically a blocked site
   * showing Chrome's error page) — only its own domain is listed then.
   */
  pageLoaded: boolean;
}

/**
 * Runs inside the page: the document's own host plus the host of every
 * resource still in the Performance buffer (scripts, images, XHR/fetch…).
 */
function collectHosts(): string[] {
  const hosts = new Set<string>();
  if (location.hostname) hosts.add(location.hostname);
  for (const entry of performance.getEntriesByType('resource')) {
    try {
      hosts.add(new URL(entry.name).hostname);
    } catch {
      // Skip entries without a parseable URL (e.g. blob:).
    }
  }
  hosts.delete('');
  return [...hosts];
}

async function findScanTarget() {
  const [focused] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
  if (focused?.url && /^https?:/.test(focused.url)) return focused;
  // Standalone-window mode: the focused window is the extension itself, so
  // fall back to the most recently used tab of a normal browser window.
  const candidates = await browser.tabs.query({ active: true, windowType: 'normal' });
  return candidates
    .filter((t) => t.url && /^https?:/.test(t.url))
    .sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))[0];
}

/** Scans the active browser tab and returns the hosts it loaded. */
export async function scanActiveTab(): Promise<ScanResult> {
  const tab = await findScanTarget();
  if (!tab?.id || !tab.url) {
    throw new Error('The active tab is not a regular web page.');
  }
  const pageHost = new URL(tab.url).hostname;

  let results;
  try {
    results = await browser.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: collectHosts,
    });
  } catch {
    // Injection fails on Chrome's error page — the very case where the site
    // itself is blocked. Fall back to the tab's intended host: route it,
    // reload, and the next scan will see what the page loads.
    return { pageHost, hosts: [pageHost], pageLoaded: false };
  }

  const hosts = new Set<string>();
  for (const frame of results) {
    for (const host of frame.result ?? []) hosts.add(host);
  }
  hosts.delete(pageHost);
  return { pageHost, hosts: [pageHost, ...[...hosts].sort()], pageLoaded: true };
}

/* ── Grouping ─────────────────────────────────────────────────────────── */

export interface HostGroup {
  /** Registrable domain (eTLD+1), or the bare host when there is none (IPs). */
  domain: string;
  /** Scanned subdomains under this domain (the bare domain itself excluded). */
  subs: string[];
  /** Every scanned host of the group, for probing and selection. */
  hosts: string[];
}

/**
 * Groups scanned hosts by their registrable domain. Selecting a whole group
 * means adding just the eTLD+1 — Keenetic covers subdomains automatically.
 */
export function groupHosts(hosts: string[]): HostGroup[] {
  const map = new Map<string, string[]>();
  for (const host of hosts) {
    const domain = getDomain(host) ?? host;
    const members = map.get(domain);
    if (members) members.push(host);
    else map.set(domain, [host]);
  }
  return [...map.entries()].map(([domain, members]) => ({
    domain,
    subs: members.filter((h) => h !== domain).sort(),
    hosts: members,
  }));
}

/** "www.example.com" → "example.com" — a friendly default name for a scanned list. */
export function mainDomain(host: string): string {
  return getDomain(host) ?? host;
}

