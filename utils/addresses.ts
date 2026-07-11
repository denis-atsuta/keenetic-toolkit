/**
 * Address-list normalization.
 *
 * Keenetic auto-includes every subdomain of a listed domain, so a subdomain
 * is redundant when its parent is present ("foo.test.com" ⊂ "test.com"). IP
 * ranges fold the same way: an address or subnet is redundant when a broader
 * CIDR in the list already covers it ("10.0.0.5" ⊂ "10.0.0.0/24").
 */

interface ParsedIp {
  version: 4 | 6;
  value: bigint;
  prefix: number;
}

const V4_BITS = 32;
const V6_BITS = 128;

function parseIp(input: string): ParsedIp | null {
  const [addr, prefixStr, extra] = input.split('/');
  if (extra !== undefined) return null;

  if (addr.includes(':')) {
    const value = parseIpv6(addr);
    if (value === null) return null;
    const prefix = prefixStr === undefined ? V6_BITS : Number(prefixStr);
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > V6_BITS) return null;
    return { version: 6, value, prefix };
  }

  const octets = addr.split('.');
  if (octets.length !== 4) return null;
  let value = 0n;
  for (const o of octets) {
    if (!/^\d{1,3}$/.test(o)) return null;
    const n = Number(o);
    if (n > 255) return null;
    value = (value << 8n) | BigInt(n);
  }
  const prefix = prefixStr === undefined ? V4_BITS : Number(prefixStr);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > V4_BITS) return null;
  return { version: 4, value, prefix };
}

function parseIpv6(addr: string): bigint | null {
  const halves = addr.split('::');
  if (halves.length > 2) return null;

  const toGroups = (s: string) => (s === '' ? [] : s.split(':'));
  const head = toGroups(halves[0]);
  const tail = halves.length === 2 ? toGroups(halves[1]) : [];

  let groups: string[];
  if (halves.length === 2) {
    const fill = 8 - head.length - tail.length;
    if (fill < 0) return null;
    groups = [...head, ...Array(fill).fill('0'), ...tail];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;

  let value = 0n;
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(g)) return null;
    value = (value << 16n) | BigInt(parseInt(g, 16));
  }
  return value;
}

/** True when `outer` is a broader CIDR that contains `inner`. */
function contains(outer: ParsedIp, inner: ParsedIp): boolean {
  if (outer.version !== inner.version) return false;
  if (outer.prefix > inner.prefix) return false;
  const bits = outer.version === 4 ? V4_BITS : V6_BITS;
  const host = BigInt(bits - outer.prefix);
  return outer.value >> host === inner.value >> host;
}

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

/** `child` is `parent` itself or one of its subdomains. */
function isSubdomainOf(child: string, parent: string): boolean {
  return child === parent || child.endsWith('.' + parent);
}

/**
 * Cleans and folds an address list: trims, lowercases, de-duplicates, drops
 * subdomains covered by a listed parent domain and IPs/subnets covered by a
 * broader CIDR. Entries that are neither a domain nor an IP are kept as-is.
 * Original order is preserved.
 */
export function normalizeAddresses(entries: string[]): string[] {
  interface Item {
    raw: string;
    key: string;
    domain?: string;
    ip?: ParsedIp;
  }

  const items: Item[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const raw = entry.trim();
    if (!raw) continue;
    const ip = parseIp(raw) ?? undefined;
    const domain = ip ? undefined : DOMAIN_RE.test(raw) ? raw.toLowerCase() : undefined;
    const key = ip ? `ip:${ip.version}:${ip.value >> BigInt((ip.version === 4 ? V4_BITS : V6_BITS) - ip.prefix)}/${ip.prefix}` : domain ? `d:${domain}` : `o:${raw}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ raw, key, domain, ip });
  }

  const domains = items.filter((i) => i.domain).map((i) => i.domain!);
  const ips = items.filter((i) => i.ip).map((i) => i.ip!);

  return items
    .filter((item) => {
      if (item.domain) {
        return !domains.some((p) => p !== item.domain && isSubdomainOf(item.domain!, p));
      }
      if (item.ip) {
        return !ips.some((c) => c !== item.ip && contains(c, item.ip!));
      }
      return true;
    })
    .map((i) => i.raw);
}
