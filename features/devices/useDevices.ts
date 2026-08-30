import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeeneticApi, type DevicesSnapshot, type PolicyState } from '@/utils/keenetic/api';
import { KeeneticClient } from '@/utils/keenetic/client';
import type { RouterSettings } from '@/utils/settings';

export type DevicesData = DevicesSnapshot;

// The router answers slowly (~0.5 s plus an auth handshake on a cold
// session), so the last snapshot is cached per router and shown immediately
// while a fresh fetch runs in the background.
const devicesCache = storage.defineItem<Record<string, DevicesData>>('session:devicesCache', {
  fallback: {},
});

export interface UseDevices {
  data: DevicesData | null;
  error: string | null;
  /** MACs with an in-flight state change. */
  saving: ReadonlySet<string>;
  changeState: (mac: string, state: PolicyState) => Promise<void>;
  register: (mac: string) => Promise<void>;
  /** Re-fetches from the router; drives the poll and the refresh button. */
  reload: () => Promise<void>;
}

/** Loads devices, policies and their access states, and applies changes. */
export function useDevices(settings: RouterSettings): UseDevices {
  const api = useMemo(() => new KeeneticApi(new KeeneticClient(settings)), [settings]);
  const [data, setData] = useState<DevicesData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<ReadonlySet<string>>(new Set());

  // Answers that arrive after the user switched routers must not be painted.
  const originRef = useRef(settings.origin);
  useEffect(() => {
    originRef.current = settings.origin;
  }, [settings.origin]);

  const reload = useCallback(() => {
    const origin = settings.origin;
    return api
      .getDevices()
      .then((fresh) => {
        if (originRef.current !== origin) return;
        setData(fresh);
        setError(null);
        return devicesCache
          .getValue()
          .then((cache) => devicesCache.setValue({ ...cache, [origin]: fresh }));
      })
      .catch((e) => {
        if (originRef.current !== origin) return;
        setError(e instanceof Error ? e.message : String(e));
      });
  }, [api, settings.origin]);

  useEffect(() => {
    let cancelled = false;
    // Stale-while-revalidate: paint the cached snapshot instantly (unless the
    // fresh fetch won the race), then let reload() replace it.
    void devicesCache.getValue().then((c) => {
      const hit = c[settings.origin];
      if (!cancelled && hit) setData((prev) => prev ?? hit);
    });
    void reload();
    return () => {
      cancelled = true;
    };
  }, [reload, settings.origin]);

  async function changeState(mac: string, state: PolicyState) {
    setSaving((prev) => new Set(prev).add(mac));
    setError(null);
    try {
      await api.setHostState(mac, state);
      setData((prev) => prev && { ...prev, states: { ...prev.states, [mac]: state } });
      // Keep the cached snapshot in sync so a quick close/reopen shows the
      // change without waiting for the background refresh.
      if (data) {
        const next = { ...data, states: { ...data.states, [mac]: state } };
        const c = await devicesCache.getValue();
        void devicesCache.setValue({ ...c, [settings.origin]: next });
      }
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

  /** Registers the host as known, named after its DHCP hostname (or MAC). */
  async function register(mac: string) {
    const host = data?.hosts.find((h) => h.mac === mac);
    const name = host?.hostname ?? host?.name ?? mac.replace(/:/g, '');
    setSaving((prev) => new Set(prev).add(mac));
    setError(null);
    try {
      await api.registerHost(mac, name);
      const patch = (d: DevicesData): DevicesData => ({
        ...d,
        hosts: d.hosts.map((h) =>
          h.mac === mac ? { ...h, registered: true, name: h.name ?? name } : h,
        ),
      });
      setData((prev) => prev && patch(prev));
      if (data) {
        const next = patch(data);
        const c = await devicesCache.getValue();
        void devicesCache.setValue({ ...c, [settings.origin]: next });
      }
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

  return { data, error, saving, changeState, register, reload };
}
