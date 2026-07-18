import { useEffect, useState } from 'react';
import { getHiddenPolicies, toggleHiddenPolicy } from '@/utils/policy-visibility';

/** Per-router policy options hidden from the device selector. */
export function useHiddenPolicies(origin: string) {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    void getHiddenPolicies(origin).then((h) => {
      if (!cancelled) setHidden(h);
    });
    return () => {
      cancelled = true;
    };
  }, [origin]);

  async function toggle(value: string) {
    setHidden(await toggleHiddenPolicy(origin, value));
  }

  return { hidden, toggle };
}
