import { useEffect, useMemo, useState } from 'react';
import {
  KeeneticApi,
  type HostStates,
  type HotspotHost,
  type Policy,
  type PolicyState,
} from '@/utils/keenetic/api';
import { KeeneticClient } from '@/utils/keenetic/client';
import type { RouterSettings } from '@/utils/settings';

/** <select> values: the three fixed states plus "p:<PolicyN>". */
const DEFAULT = 'default';
const SEGMENT = 'segment';
const DENY = 'deny';
const POLICY_PREFIX = 'p:';

function toSelectValue(state: PolicyState | undefined): string {
  if (!state) return DEFAULT;
  return state.kind === 'policy' ? POLICY_PREFIX + state.id : state.kind;
}

function fromSelectValue(value: string): PolicyState {
  if (value.startsWith(POLICY_PREFIX)) {
    return { kind: 'policy', id: value.slice(POLICY_PREFIX.length) };
  }
  return { kind: value as 'default' | 'segment' | 'deny' };
}

interface HostListData {
  policies: Policy[];
  hosts: HotspotHost[];
  states: HostStates;
}

export function HostList({ settings }: { settings: RouterSettings }) {
  const api = useMemo(() => new KeeneticApi(new KeeneticClient(settings)), [settings]);
  const [data, setData] = useState<HostListData | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** MACs with an in-flight state change. */
  const [saving, setSaving] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getPolicies(), api.getHosts(), api.getHostStates()])
      .then(([policies, hosts, states]) => {
        if (!cancelled) setData({ policies, hosts: sortHosts(hosts), states });
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  async function changeState(mac: string, value: string) {
    const state = fromSelectValue(value);
    setSaving((prev) => new Set(prev).add(mac));
    setError(null);
    try {
      await api.setHostState(mac, state);
      setData((prev) => prev && { ...prev, states: { ...prev.states, [mac]: state } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(mac);
        return next;
      });
    }
  }

  if (error && !data) return <p className="error">{error}</p>;
  if (!data) return <p className="hint">Loading devices…</p>;

  return (
    <>
      {error && <p className="error">{error}</p>}
      <ul className="host-list">
        {data.hosts.map((host) => (
          <li key={host.mac} className="host-row">
            <span
              className={`presence ${host.active ? 'presence-on' : ''}`}
              title={host.active ? 'online' : 'offline'}
            />
            <span className="host-info">
              <span className="host-name">{host.name ?? host.mac}</span>
              <span className="host-ip">{host.ip ?? host.mac}</span>
            </span>
            <select
              value={toSelectValue(data.states[host.mac])}
              disabled={saving.has(host.mac) || host.registered === false}
              title={
                host.registered === false
                  ? 'Unregistered device — register it in the router UI first'
                  : undefined
              }
              onChange={(e) => void changeState(host.mac, e.target.value)}
            >
              <option value={DEFAULT}>Default</option>
              <option value={SEGMENT}>Segment default</option>
              {data.policies.map((p) => (
                <option key={p.id} value={POLICY_PREFIX + p.id}>
                  {p.description}
                </option>
              ))}
              <option value={DENY}>No internet</option>
            </select>
          </li>
        ))}
      </ul>
    </>
  );
}

function sortHosts(hosts: HotspotHost[]): HotspotHost[] {
  return [...hosts].sort(
    (a, b) =>
      Number(b.active ?? false) - Number(a.active ?? false) ||
      (a.name ?? a.mac).localeCompare(b.name ?? b.mac),
  );
}
