import { KeeneticApiError, type KeeneticClient } from './client';

export interface Policy {
  /** Internal id, e.g. "Policy0" */
  id: string;
  /** User-visible name from the web UI */
  description: string;
}

export interface HotspotHost {
  mac: string;
  /** User-assigned name, falls back to DHCP hostname */
  name?: string;
  hostname?: string;
  ip?: string;
  active?: boolean;
  /** Only registered (known) hosts can be assigned a policy. */
  registered?: boolean;
}

/**
 * The four access states a host can be in, mirroring the web UI dropdown.
 * Verified against a live KeeneticOS 5.1 config (see how each state is
 * stored in /rci/ip/hotspot/host):
 * - default:  {permit: true} — router's default policy
 * - segment:  {permit: true, conform: true} — follow the segment's policy
 * - policy:   {permit: true, policy: "PolicyN"}
 * - deny:     {deny: true} — no internet access (a previously assigned
 *             policy stays in the config but is inert, so deny wins)
 */
export type PolicyState =
  { kind: 'default' } | { kind: 'segment' } | { kind: 'deny' } | { kind: 'policy'; id: string };

/** mac → access state; hosts without a config entry are on the default. */
export type HostStates = Record<string, PolicyState>;

interface RawPolicyMap {
  [id: string]: { description?: string };
}

interface RawHotspot {
  host?: Array<{
    mac?: string;
    name?: string;
    hostname?: string;
    ip?: string;
    active?: boolean;
    registered?: boolean;
  }>;
}

type RawHostConfig = Array<{
  mac?: string;
  policy?: string;
  deny?: boolean;
  conform?: boolean;
}>;

/** Typed wrappers over the RCI endpoints the extension uses. */
export class KeeneticApi {
  constructor(private readonly client: KeeneticClient) {}

  /** Configured policies. The default/segment/deny states are not in this list. */
  async getPolicies(): Promise<Policy[]> {
    const raw = await this.orEmpty<RawPolicyMap>('/ip/policy', {});
    return Object.entries(raw).map(([id, v]) => ({ id, description: v?.description || id }));
  }

  /** All hosts the router has seen, active or not. */
  async getHosts(): Promise<HotspotHost[]> {
    const raw = await this.client.rci<RawHotspot>('/show/ip/hotspot');
    return (raw.host ?? [])
      .filter((h): h is typeof h & { mac: string } => Boolean(h.mac))
      .map((h) => ({
        mac: h.mac.toLowerCase(),
        name: h.name || h.hostname || undefined,
        hostname: h.hostname,
        // Offline hosts report the placeholder 0.0.0.0 — not a real address.
        ip: h.ip === '0.0.0.0' ? undefined : h.ip,
        active: h.active,
        registered: h.registered,
      }));
  }

  /**
   * Host access states from the running config (`show ip hotspot host`
   * omitted the policy field on some firmwares, so the config is the
   * reliable source).
   */
  async getHostStates(): Promise<HostStates> {
    const raw = await this.orEmpty<RawHostConfig>('/ip/hotspot/host', []);
    const states: HostStates = {};
    for (const entry of raw) {
      if (!entry.mac) continue;
      states[entry.mac.toLowerCase()] = entry.deny
        ? { kind: 'deny' }
        : entry.conform
          ? { kind: 'segment' }
          : entry.policy
            ? { kind: 'policy', id: entry.policy }
            : { kind: 'default' };
    }
    return states;
  }

  /**
   * Puts a host into the given access state and persists the config, both
   * in one batch request. Assigning a policy clears `conform` and vice
   * versa on the router side; the explicit default resets both.
   */
  async setHostState(mac: string, state: PolicyState): Promise<void> {
    const payload =
      state.kind === 'deny'
        ? { mac, deny: true }
        : state.kind === 'segment'
          ? { mac, permit: true, conform: true }
          : state.kind === 'policy'
            ? { mac, permit: true, policy: state.id }
            : { mac, permit: true, policy: false, conform: false };
    await this.client.rciBatch([
      { ip: { hotspot: { host: payload } } },
      { system: { configuration: { save: {} } } },
    ]);
  }

  /**
   * Registers a host as known under the given name and persists the config.
   * Registration is what unlocks policy assignment for the host.
   */
  async registerHost(mac: string, name: string): Promise<void> {
    await this.client.rciBatch([
      { known: { host: { mac, name } } },
      { system: { configuration: { save: {} } } },
    ]);
  }

  /** GETs a config endpoint that may not exist yet (404 → fallback). */
  private async orEmpty<T>(path: string, fallback: T): Promise<T> {
    try {
      return (await this.client.rci<T | null>(path)) ?? fallback;
    } catch (e) {
      if (e instanceof KeeneticApiError && e.status === 404) return fallback;
      throw e;
    }
  }
}
