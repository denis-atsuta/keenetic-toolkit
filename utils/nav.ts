/**
 * In-app back navigation, driven by the mouse side buttons.
 *
 * Screens with an inner "back" (an open editor, the scan picker) register a
 * handler; the deepest registered handler that returns true consumes the
 * event. When nothing consumes it, the Shell falls back to the previously
 * visited section.
 */
import { useEffect, useRef } from 'react';

type BackHandler = () => boolean;

const handlers: BackHandler[] = [];

/** Last registered (deepest screen) handler wins. */
export function dispatchBack(): boolean {
  for (let i = handlers.length - 1; i >= 0; i--) {
    if (handlers[i]()) return true;
  }
  return false;
}

/** Registers `handler` for the screen's lifetime; always sees fresh state. */
export function useBackHandler(handler: BackHandler): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const h: BackHandler = () => ref.current();
    handlers.push(h);
    return () => {
      const i = handlers.indexOf(h);
      if (i >= 0) handlers.splice(i, 1);
    };
  }, []);
}
