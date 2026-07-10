import type { HotspotHost } from '@/utils/keenetic/api';

export type StatusFilter = 'all' | 'online' | 'unregistered';

export interface DeviceFilter {
  query: string;
  status: StatusFilter;
}

export const EMPTY_FILTER: DeviceFilter = { query: '', status: 'all' };

function matchesQuery(host: HotspotHost, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [host.name, host.hostname, host.ip, host.mac].some((v) => v?.toLowerCase().includes(q));
}

function matchesStatus(host: HotspotHost, status: StatusFilter): boolean {
  switch (status) {
    case 'online':
      return Boolean(host.active);
    case 'unregistered':
      return host.registered === false;
    default:
      return true;
  }
}

/** Applies the filter and sorts favorites first, then online, then by name. */
export function filterAndSortHosts(
  hosts: HotspotHost[],
  favorites: ReadonlySet<string>,
  filter: DeviceFilter,
): HotspotHost[] {
  return hosts
    .filter((h) => matchesQuery(h, filter.query) && matchesStatus(h, filter.status))
    .sort(
      (a, b) =>
        Number(favorites.has(b.mac)) - Number(favorites.has(a.mac)) ||
        Number(b.active ?? false) - Number(a.active ?? false) ||
        (a.name ?? a.mac).localeCompare(b.name ?? b.mac),
    );
}
