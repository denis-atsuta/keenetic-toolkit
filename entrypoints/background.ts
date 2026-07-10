import { ensureOriginStripRule } from '@/utils/keenetic/origin-fix';
import { getRouterOrigin } from '@/utils/settings';

export default defineBackground(() => {
  // DNR session rules are lost on browser restart; restore the Origin-strip
  // rule for the configured router whenever the service worker starts.
  void getRouterOrigin().then((origin) => {
    if (origin) return ensureOriginStripRule(origin);
  });
});
