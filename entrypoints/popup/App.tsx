import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Rail, type RailItem } from '@/components/layout/Rail';
import { DevicesScreen } from '@/features/devices/DevicesScreen';
import { RoutingScreen } from '@/features/routing/RoutingScreen';
import { ConnectScreen } from '@/features/connection/ConnectScreen';
import { AccountScreen } from '@/features/connection/AccountScreen';
import { ComingSoon } from '@/features/placeholder/ComingSoon';
import { ensureOriginStripRule } from '@/utils/keenetic/origin-fix';
import { loadConnection, type RouterProfile, type RouterSettings } from '@/utils/settings';
import './App.css';

type SectionId = 'devices' | 'routing' | 'settings' | 'account';

const NAV_ITEMS: RailItem[] = [
  { id: 'devices', icon: 'devices', label: 'Devices' },
  { id: 'routing', icon: 'routes', label: 'Routing' },
  { id: 'settings', icon: 'settings', label: 'Settings' },
];
const BOTTOM_ITEMS: RailItem[] = [{ id: 'account', icon: 'logout', label: 'Account' }];

const SECTION_TITLES: Record<SectionId, string> = {
  devices: 'Devices',
  routing: 'Routing',
  settings: 'Settings',
  account: 'Account',
};

/** True when running as the standalone resizable window, not the toolbar popup. */
const IS_WINDOW = new URLSearchParams(window.location.search).has('window');

function openInWindow() {
  void browser.windows
    .create({
      url: browser.runtime.getURL('/popup.html?window'),
      type: 'popup',
      width: 820,
      height: 640,
    })
    .then(() => window.close());
}

type Screen =
  | { kind: 'loading' }
  | { kind: 'connect'; locked?: RouterProfile }
  | { kind: 'shell'; settings: RouterSettings };

function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });

  useEffect(() => {
    loadConnection().then((state) => {
      switch (state.status) {
        case 'connected':
          void ensureOriginStripRule(state.settings.origin);
          setScreen({ kind: 'shell', settings: state.settings });
          break;
        case 'locked':
          void ensureOriginStripRule(state.profile.origin);
          setScreen({ kind: 'connect', locked: state.profile });
          break;
        case 'none':
          setScreen({ kind: 'connect' });
      }
    });
  }, []);

  switch (screen.kind) {
    case 'loading':
      return null;
    case 'connect':
      return (
        <ConnectScreen
          initial={screen.locked && { address: screen.locked.origin, login: screen.locked.login }}
          locked={Boolean(screen.locked)}
          onConnected={(settings) => setScreen({ kind: 'shell', settings })}
        />
      );
    case 'shell':
      return (
        <Shell settings={screen.settings} onLoggedOut={() => setScreen({ kind: 'connect' })} />
      );
  }
}

function Shell({
  settings,
  onLoggedOut,
}: {
  settings: RouterSettings;
  onLoggedOut: () => void;
}) {
  const [section, setSection] = useState<SectionId>('devices');

  return (
    <div className={`shell ${IS_WINDOW ? 'shell--window' : ''}`}>
      <Header
        title={settings.realm}
        subtitle={SECTION_TITLES[section]}
        onExpand={IS_WINDOW ? undefined : openInWindow}
      />
      <div className="shell__body">
        <Rail
          items={NAV_ITEMS}
          bottomItems={BOTTOM_ITEMS}
          active={section}
          onSelect={(id) => setSection(id as SectionId)}
        />
        <main className="shell__content">
          {section === 'devices' && <DevicesScreen settings={settings} />}
          {section === 'routing' && <RoutingScreen settings={settings} />}
          {section === 'settings' && <ComingSoon title="Settings" />}
          {section === 'account' && (
            <AccountScreen settings={settings} onLoggedOut={onLoggedOut} />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
