import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  imports: {
    eslintrc: {
      enabled: 9,
    },
  },
  // The dev server runs in WSL2 and cannot launch Windows-side Chrome —
  // load the extension manually via "Load unpacked" instead.
  webExt: {
    disabled: true,
  },
  manifest: {
    name: 'Keenetic Toolkit',
    description:
      'Manage Keenetic router connection policies and static routes without opening the web UI.',
    // declarativeNetRequestWithHostAccess only affects hosts the user has
    // already granted, so it adds no scary install warning; it is needed to
    // strip the Origin header (the router 403s foreign origins, CSRF guard).
    // scripting + activeTab power the page-scan feature: the user opening the
    // popup grants temporary access to the active tab only — no broad host
    // access and no extra install warning.
    permissions: ['storage', 'declarativeNetRequestWithHostAccess', 'scripting', 'activeTab'],
    // The default router address is granted up front so the first
    // Test/Connect happens without the permission prompt (which closes the
    // popup). One narrow host adds only a mild install warning.
    host_permissions: ['http://my.keenetic.net/*'],
    // Any other address (LAN IP, custom name) is requested at runtime for
    // its origin only — broad host_permissions would slow down CWS review.
    optional_host_permissions: ['http://*/*', 'https://*/*'],
  },
});
