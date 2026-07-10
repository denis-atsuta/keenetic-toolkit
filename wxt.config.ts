import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  // The dev server runs in WSL2 and cannot launch Windows-side Chrome —
  // load the extension manually via "Load unpacked" instead.
  webExt: {
    disabled: true,
  },
  manifest: {
    name: 'Keenetic Toolkit',
    description:
      'Manage Keenetic router connection policies and static routes without opening the web UI.',
    permissions: ['storage'],
    // Router access is requested at runtime for its origin only — broad
    // host_permissions would slow down Chrome Web Store review.
    optional_host_permissions: ['http://*/*', 'https://*/*'],
  },
});
