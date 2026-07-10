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

export interface DevicesData {
  policies: Policy[];
  hosts: HotspotHost[];
  states: HostStates;
}

export interface UseDevices {
  data: DevicesData | null;
  error: string | null;
  /** MACs with an in-flight state change. */
  saving: ReadonlySet<string>;
  changeState: (mac: string, state: PolicyState) => Promise<void>;
}

/** Loads devices, policies and their access states, and applies changes. */
export function useDevices(settings: RouterSettings): UseDevices {
  const api = useMemo(() => new KeeneticApi(new KeeneticClient(settings)), [settings]);
  const [data, setData] = useState<DevicesData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getPolicies(), api.getHosts(), api.getHostStates()])
      .then(([policies, hosts, states]) => {
        if (!cancelled) setData({ policies, hosts, states });
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  async function changeState(mac: string, state: PolicyState) {
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

  return { data, error, saving, changeState };
}
