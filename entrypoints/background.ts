import { ensureOriginStripRule } from '@/utils/keenetic/origin-fix';
import { routerSettings } from '@/utils/settings';

export default defineBackground(() => {
  // DNR session rules are lost on browser restart; restore the Origin-strip
  // rule for the configured router whenever the service worker starts.
  void routerSettings.getValue().then((settings) => {
    if (settings) return ensureOriginStripRule(settings.origin);
  });
});
