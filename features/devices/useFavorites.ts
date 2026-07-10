import { useEffect, useState } from 'react';
import { getFavorites, toggleFavorite } from '@/utils/favorites';

/** Per-router favorite MACs, backed by chrome.storage.local. */
export function useFavorites(origin: string) {
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    getFavorites(origin).then((f) => {
      if (!cancelled) setFavorites(f);
    });
    return () => {
      cancelled = true;
    };
  }, [origin]);

  async function toggle(mac: string) {
    setFavorites(await toggleFavorite(origin, mac));
  }

  return { favorites, toggle };
}
