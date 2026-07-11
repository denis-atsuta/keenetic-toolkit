import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeeneticClient } from '@/utils/keenetic/client';
import {
  commitListDetail,
  createList,
  deleteList,
  getRoutingData,
  setRuleEnabled,
  type AddressList,
  type ListDetailEdit,
  type NetInterface,
  type RoutingData,
} from '@/utils/keenetic/routing';
import type { RouterSettings } from '@/utils/settings';

// The router's RCI takes ~0.5 s to answer the shows (plus an auth handshake
// on a cold session), so the last result is cached per router and shown
// immediately while a fresh fetch runs in the background.
const routingCache = storage.defineItem<Record<string, RoutingData>>('session:routingCache', {
  fallback: {},
});

export interface UseRouting {
  lists: AddressList[] | null;
  interfaces: NetInterface[];
  error: string | null;
  saving: ReadonlySet<string>;
  setEnabled: (listId: string, index: string, enabled: boolean) => Promise<void>;
  saveDetail: (original: AddressList, edit: ListDetailEdit) => Promise<void>;
  removeList: (listId: string) => Promise<void>;
}

/** Loads address lists with their routing rules, and edits them. */
export function useRouting(settings: RouterSettings): UseRouting {
  const client = useMemo(() => new KeeneticClient(settings), [settings]);
  const [lists, setLists] = useState<AddressList[] | null>(null);
  const [interfaces, setInterfaces] = useState<NetInterface[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<ReadonlySet<string>>(new Set());

  const reload = useCallback(
    () =>
      getRoutingData(client)
        .then((data) => {
          setLists(data.lists);
          setInterfaces(data.interfaces);
          void routingCache
            .getValue()
            .then((c) => routingCache.setValue({ ...c, [settings.origin]: data }));
        })
        .catch((e) => setError(e instanceof Error ? e.message : String(e))),
    [client, settings.origin],
  );

  useEffect(() => {
    let cancelled = false;
    // Stale-while-revalidate: paint the cached snapshot instantly (unless the
    // fresh fetch won the race), then let reload() replace it.
    void routingCache.getValue().then((c) => {
      const hit = c[settings.origin];
      if (cancelled || !hit) return;
      setLists((prev) => prev ?? hit.lists);
      setInterfaces((prev) => (prev.length > 0 ? prev : hit.interfaces));
    });
    void reload();
    return () => {
      cancelled = true;
    };
  }, [reload, settings.origin]);

  function withSaving<T>(listId: string, op: () => Promise<T>): Promise<T> {
    setSaving((prev) => new Set(prev).add(listId));
    setError(null);
    return op()
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        throw e;
      })
      .finally(() => {
        setSaving((prev) => {
          const next = new Set(prev);
          next.delete(listId);
          return next;
        });
      });
  }

  async function setEnabled(listId: string, index: string, enabled: boolean) {
    await withSaving(listId, async () => {
      await setRuleEnabled(client, index, enabled);
      setLists(
        (prev) =>
          prev?.map((l) =>
            l.id === listId && l.rule ? { ...l, rule: { ...l.rule, enabled } } : l,
          ) ?? prev,
      );
    });
  }

  async function saveDetail(original: AddressList, edit: ListDetailEdit) {
    // An empty id marks a not-yet-created list.
    await withSaving(original.id || '__new__', async () => {
      if (original.id === '') {
        await createList(client, lists?.map((l) => l.id) ?? [], edit);
      } else {
        await commitListDetail(client, original, edit);
      }
      // Rename/index/rule can all change, so re-read rather than patch.
      await reload();
    });
  }

  async function removeList(listId: string) {
    await withSaving(listId, async () => {
      await deleteList(client, listId);
      await reload();
    });
  }

  return { lists, interfaces, error, saving, setEnabled, saveDetail, removeList };
}
