/**
 * Manual refresh, driven by the header button.
 *
 * The visible screen registers how to reload itself and the Header dispatches
 * without knowing which screen is showing — the same registry shape as the
 * back-navigation handlers in `utils/nav.ts`.
 */
import { useEffect, useRef } from 'react';

type RefreshHandler = () => Promise<void>;

const handlers: RefreshHandler[] = [];

/** Runs the last registered (deepest screen) handler; false when there is none. */
export async function dispatchRefresh(): Promise<boolean> {
  const handler = handlers[handlers.length - 1];
  if (!handler) return false;
  await handler();
  return true;
}

/** Registers `handler` for the screen's lifetime; always sees fresh state. */
export function useRefreshHandler(handler: RefreshHandler): void {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    const h: RefreshHandler = () => ref.current();
    handlers.push(h);
    return () => {
      const i = handlers.indexOf(h);
      if (i >= 0) handlers.splice(i, 1);
    };
  }, []);
}
