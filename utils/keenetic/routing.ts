import type { KeeneticClient } from './client';

/** The routing rule attached to an address list (0 or 1 per list). */
export interface RuleInfo {
  /** Stable id of the rule, used for enable/disable. */
  index: string;
  interfaceId: string;
  interfaceName: string;
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
}

export interface NetInterface {
  id: string;
  name: string;
}

interface RawRoute {
  group?: string;
  interface?: string;
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
}

/** Lists joined with their routing rule and interface names, for display. */
export async function getRoutingLists(client: KeeneticClient): Promise<AddressList[]> {
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

  const ruleByGroup = new Map<string, RawRoute>();
  for (const r of routes) if (r.group) ruleByGroup.set(r.group, r);

  return Object.entries(groups)
    .map(([id, g]) => {
      const r = ruleByGroup.get(id);
      const rule: RuleInfo | undefined =
        r && r.index
          ? {
              index: r.index,
              interfaceId: r.interface ?? '',
              interfaceName: r.interface ? interfaceName(r.interface) : '',
              enabled: !r.disable,
              auto: Boolean(r.auto),
              exclusive: Boolean(r.reject),
            }
          : undefined;
      return {
        id,
        name: g.description || id,
        addresses: (g.include ?? [])
          .map((e) => e.address)
          .filter((a): a is string => Boolean(a)),
        rule,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Interfaces selectable as a route target, with their friendly names. */
export async function getInterfaces(client: KeeneticClient): Promise<NetInterface[]> {
  const [res] = await client.rciBatch([{ show: { interface: {} } }]);
  const raw = (extract(res, ['show', 'interface']) as Record<string, RawInterface>) ?? {};
  return Object.entries(raw)
    .map(([id, v]) => ({ id, name: v?.description || v?.['interface-name'] || id }))
    .sort((a, b) => a.name.localeCompare(b.name));
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
        route: { group: id, interface: edit.interfaceId, auto: edit.auto, reject: edit.exclusive },
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
  interfaceId: string;
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
    // Create or update the rule (keyed by list); the write yields an enabled rule.
    ops.push({
      'dns-proxy': {
        route: {
          group: id,
          interface: edit.interfaceId,
          auto: edit.auto,
          reject: edit.exclusive,
        },
      },
    });
  } else if (original.rule) {
    // Was routed, now off — disable the rule (keeps it, no:false = disabled).
    ops.push({ 'dns-proxy': { route: { disable: { index: original.rule.index, no: false } } } });
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

/** Enables or disables a rule (identified by index) and persists the config. */
export async function setRuleEnabled(
  client: KeeneticClient,
  index: string,
  enabled: boolean,
): Promise<void> {
  await client.rciBatch([
    // `no` negates the disable, so no=true means enabled.
    { 'dns-proxy': { route: { disable: { index, no: enabled } } } },
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
