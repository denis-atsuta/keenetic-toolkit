import type { KeeneticClient } from './client';

/** The routing rule attached to an address list (0 or 1 per list). */
export interface RuleInfo {
  /** Stable id of the rule, used for enable/disable. */
  index: string;
  interfaceId: string;
  interfaceName: string;
  /** Set instead of the interface when the route is pinned to a gateway. */
  gateway: string;
  enabled: boolean;
  /** "Добавлять автоматически" — auto-add resolved addresses. */
  auto: boolean;
  /** "Эксклюзивный маршрут" — reject non-matching. */
  exclusive: boolean;
}

/** An address list (domains + IP/CIDR) and its optional routing rule. */
export interface AddressList {
  /** e.g. "domain-list0". */
  id: string;
  /** Friendly name (object-group fqdn description). */
  name: string;
  /** Entries: domains and/or IP/CIDR, one per line in the UI. */
  addresses: string[];
  /** Undefined when the list is not routed anywhere. */
  rule?: RuleInfo;
  /**
   * Indexes of every dns-proxy route the router holds for this list. Normally
   * one; more means earlier edits left rules behind (see `commitListDetail`).
   */
  ruleIndexes: string[];
}

export interface NetInterface {
  id: string;
  name: string;
}

/**
 * Stands for the web UI's "any interface" choice. It is not an RCI value: such
 * a route carries a `gateway` address instead of an `interface`, and the
 * router picks the interface from the gateway's subnet.
 */
export const ANY_INTERFACE = '__any__';

interface RawRoute {
  group?: string;
  interface?: string;
  gateway?: string;
  index?: string;
  auto?: boolean;
  reject?: boolean;
  disable?: boolean;
}

interface RawFqdnGroup {
  description?: string;
  include?: Array<{ address?: string }>;
}

interface RawInterface {
  description?: string;
  'interface-name'?: string;
  type?: string;
  traits?: string[];
}

/** Everything the Routing screen needs, fetched in one round-trip. */
export interface RoutingData {
  lists: AddressList[];
  interfaces: NetInterface[];
}

/**
 * Lists joined with their routing rule and interface names, plus the
 * interfaces for the rule editor. One batch: the router's RCI is slow
 * (~150 ms per `show`), so a second parallel request is a waste.
 */
export async function getRoutingData(client: KeeneticClient): Promise<RoutingData> {
  const [groupsRes, routesRes, ifacesRes] = await client.rciBatch([
    { show: { sc: { 'object-group': { fqdn: {} } } } },
    { show: { sc: { 'dns-proxy': { route: {} } } } },
    { show: { interface: {} } },
  ]);

  const groups =
    (extract(groupsRes, ['show', 'sc', 'object-group', 'fqdn']) as Record<string, RawFqdnGroup>) ??
    {};
  const routes = (extract(routesRes, ['show', 'sc', 'dns-proxy', 'route']) as RawRoute[]) ?? [];
  const ifaces = (extract(ifacesRes, ['show', 'interface']) as Record<string, RawInterface>) ?? {};

  const interfaceName = (id: string) =>
    ifaces[id]?.description || ifaces[id]?.['interface-name'] || id;

  const routesByGroup = new Map<string, RawRoute[]>();
  for (const r of routes) {
    if (!r.group) continue;
    const existing = routesByGroup.get(r.group);
    if (existing) existing.push(r);
    else routesByGroup.set(r.group, [r]);
  }

  const lists = Object.entries(groups)
    .map(([id, g]) => {
      const groupRoutes = routesByGroup.get(id) ?? [];
      // The last one wins in the UI, matching what the router applies.
      const r = groupRoutes[groupRoutes.length - 1];
      const rule: RuleInfo | undefined =
        r && r.index
          ? {
              index: r.index,
              interfaceId: r.interface ?? '',
              interfaceName: r.interface ? interfaceName(r.interface) : '',
              gateway: r.gateway ?? '',
              enabled: !r.disable,
              auto: Boolean(r.auto),
              exclusive: Boolean(r.reject),
            }
          : undefined;
      return {
        id,
        name: g.description || id,
        addresses: (g.include ?? []).map((e) => e.address).filter((a): a is string => Boolean(a)),
        rule,
        ruleIndexes: groupRoutes.map((x) => x.index).filter((i): i is string => Boolean(i)),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // `show interface` also returns switch ports and radio masters, which cannot
  // carry a route. The "Ip" trait is what the router's own web UI filters on,
  // and reproduces its list exactly.
  const routable = Object.entries(ifaces).filter(([, v]) => v?.traits?.includes('Ip'));
  const labelOf = (id: string, v: RawInterface | undefined) =>
    v?.description || v?.['interface-name'] || id;

  const labelUses = new Map<string, number>();
  for (const [id, v] of routable) {
    const label = labelOf(id, v);
    labelUses.set(label, (labelUses.get(label) ?? 0) + 1);
  }

  const interfaces = routable
    .map(([id, v]) => {
      const label = labelOf(id, v);
      const type = v?.type;
      // Several connections share one description ("Broadband connection");
      // the web UI tells them apart by type, so do the same when a label
      // is not unique on its own.
      return { id, name: (labelUses.get(label) ?? 0) > 1 && type ? `${label} (${type})` : label };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return { lists, interfaces };
}

/**
 * Where a route sends the traffic: an interface, or a gateway address when the
 * user picked ANY_INTERFACE.
 */
function routeTarget(edit: ListDetailEdit) {
  return edit.interfaceId === ANY_INTERFACE
    ? { gateway: edit.gateway }
    : { interface: edit.interfaceId };
}

/** Next free "domain-listN" id, matching the web UI's naming scheme. */
function nextListId(existingIds: string[]): string {
  let max = -1;
  for (const id of existingIds) {
    const m = /^domain-list(\d+)$/.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `domain-list${max + 1}`;
}

/** Creates a new address list (name, addresses, optional routing) and saves. */
export async function createList(
  client: KeeneticClient,
  existingIds: string[],
  edit: ListDetailEdit,
): Promise<void> {
  const id = nextListId(existingIds);
  const ops: unknown[] = [{ 'object-group': { fqdn: { name: id } } }];
  const name = edit.name.trim();
  if (name) ops.push({ 'object-group': { fqdn: { name: id, description: name } } });
  for (const address of edit.addresses) {
    ops.push({ 'object-group': { fqdn: { name: id, include: { address } } } });
  }
  if (edit.routed) {
    ops.push({
      'dns-proxy': {
        route: { group: id, ...routeTarget(edit), auto: edit.auto, reject: edit.exclusive },
      },
    });
  }
  ops.push({ system: { configuration: { save: {} } } });
  await client.rciBatch(ops);
}

/** The full editable state of a list-detail screen. */
export interface ListDetailEdit {
  name: string;
  addresses: string[];
  routed: boolean;
  /** An interface id, or ANY_INTERFACE to route via `gateway` instead. */
  interfaceId: string;
  gateway: string;
  auto: boolean;
  exclusive: boolean;
}

/**
 * Commits every change made in the list detail — rename, address add/remove
 * diff, and routing (create/update the rule, or disable it) — in one batch,
 * then saves. No-op when nothing changed.
 */
export async function commitListDetail(
  client: KeeneticClient,
  original: AddressList,
  edit: ListDetailEdit,
): Promise<void> {
  const id = original.id;
  const ops: unknown[] = [];

  const name = edit.name.trim();
  if (name && name !== original.name) {
    ops.push({ 'object-group': { fqdn: { name: id, description: name } } });
  }

  const current = new Set(original.addresses);
  const next = new Set(edit.addresses);
  for (const address of edit.addresses) {
    if (!current.has(address)) {
      ops.push({ 'object-group': { fqdn: { name: id, include: { address } } } });
    }
  }
  for (const address of original.addresses) {
    if (!next.has(address)) {
      ops.push({ 'object-group': { fqdn: { name: id, include: { address, no: true } } } });
    }
  }

  if (edit.routed) {
    const unchanged =
      original.rule?.enabled === true &&
      original.ruleIndexes.length === 1 &&
      original.rule.auto === edit.auto &&
      original.rule.exclusive === edit.exclusive &&
      (edit.interfaceId === ANY_INTERFACE
        ? original.rule.gateway === edit.gateway
        : original.rule.interfaceId === edit.interfaceId);
    if (!unchanged) {
      // A route is keyed by a hash of its contents, so writing a changed one
      // ADDS a rule instead of replacing the old (verified on a live router:
      // the reply is "added the DNS route"). Drop what the group had first;
      // that also heals lists an earlier version already duplicated.
      for (const index of original.ruleIndexes) {
        ops.push({ 'dns-proxy': { route: { index, no: true } } });
      }
      // A fresh write yields an enabled rule.
      ops.push({
        'dns-proxy': {
          route: { group: id, ...routeTarget(edit), auto: edit.auto, reject: edit.exclusive },
        },
      });
    }
  } else if (original.rule) {
    // Was routed, now off — disable the rules (keeps them, no:false = disabled).
    for (const index of original.ruleIndexes) {
      ops.push({ 'dns-proxy': { route: { disable: { index, no: false } } } });
    }
  }

  if (ops.length === 0) return;
  ops.push({ system: { configuration: { save: {} } } });
  await client.rciBatch(ops);
}

/** Parses a textarea (one address per line) into a clean address list. */
export function parseAddresses(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of text.split('\n')) {
    const a = line.trim();
    if (a && !seen.has(a)) {
      seen.add(a);
      out.push(a);
    }
  }
  return out;
}

/**
 * Deletes a list. The router cascades — its routing rule (if any) is removed
 * automatically — then the config is saved.
 */
export async function deleteList(client: KeeneticClient, listId: string): Promise<void> {
  await client.rciBatch([
    { 'object-group': { fqdn: { name: listId, no: true } } },
    { system: { configuration: { save: {} } } },
  ]);
}

/** Enables or disables a list's rules (by index) and persists the config. */
export async function setRuleEnabled(
  client: KeeneticClient,
  indexes: string[],
  enabled: boolean,
): Promise<void> {
  if (indexes.length === 0) return;
  await client.rciBatch([
    // `no` negates the disable, so no=true means enabled.
    ...indexes.map((index) => ({ 'dns-proxy': { route: { disable: { index, no: enabled } } } })),
    { system: { configuration: { save: {} } } },
  ]);
}

function extract(value: unknown, path: string[]): unknown {
  return path.reduce<unknown>(
    (acc, key) =>
      acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined,
    value,
  );
}
