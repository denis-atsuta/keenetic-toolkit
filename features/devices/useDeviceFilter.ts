import { useEffect, useState } from 'react';
import { EMPTY_FILTER, type DeviceFilter } from './filter';

/** Persisted so the popup reopens with the same filter the user left. */
const filterStore = storage.defineItem<DeviceFilter>('local:deviceFilter', {
  fallback: EMPTY_FILTER,
});

export function useDeviceFilter(): [DeviceFilter, (filter: DeviceFilter) => void] {
  const [filter, setFilter] = useState<DeviceFilter>(EMPTY_FILTER);

  useEffect(() => {
    let cancelled = false;
    void filterStore.getValue().then((stored) => {
      if (!cancelled) setFilter(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function update(next: DeviceFilter) {
    setFilter(next);
    void filterStore.setValue(next);
  }

  return [filter, update];
}
