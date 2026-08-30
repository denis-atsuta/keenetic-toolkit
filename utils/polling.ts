/**
 * Background refresh for the visible screen.
 *
 * The router has no push channel, so staying current means asking again. The
 * next run is scheduled only once the previous one settles: a slow answer
 * delays the poll instead of queueing more requests behind it.
 */
import { useEffect, useRef } from 'react';

const DEFAULT_INTERVAL_MS = 5000;

/**
 * Calls `tick` every `intervalMs` while `active` and the document is visible.
 * A hidden standalone window skips its turns and refreshes the moment it comes
 * back; the toolbar popup is never hidden while it is open.
 */
export function usePolling(
  tick: () => Promise<void>,
  active: boolean,
  intervalMs: number = DEFAULT_INTERVAL_MS,
): void {
  // Kept in a ref so a fresh callback identity does not restart the timer.
  const tickRef = useRef(tick);
  useEffect(() => {
    tickRef.current = tick;
  });

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      timer = setTimeout(run, intervalMs);
    };

    function run() {
      if (stopped) return;
      if (document.hidden) {
        schedule();
        return;
      }
      void tickRef.current().finally(() => {
        if (!stopped) schedule();
      });
    }

    schedule();

    const onVisibilityChange = () => {
      if (document.hidden || stopped) return;
      clearTimeout(timer);
      run();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [active, intervalMs]);
}
