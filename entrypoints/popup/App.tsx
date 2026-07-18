import { useEffect, useRef, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Rail, type RailItem } from '@/components/layout/Rail';
import { DevicesScreen } from '@/features/devices/DevicesScreen';
import { RoutingScreen } from '@/features/routing/RoutingScreen';
import { ScanScreen } from '@/features/scan/ScanScreen';
import { ConnectScreen } from '@/features/connection/ConnectScreen';
import { AccountScreen } from '@/features/connection/AccountScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { ensureOriginStripRule } from '@/utils/keenetic/origin-fix';
import { loadConnection, type RouterProfile, type RouterSettings } from '@/utils/settings';
import { dispatchBack } from '@/utils/nav';
import { loadSection, saveSection, type SectionId } from '@/utils/ui-state';
import './App.css';

const NAV_ITEMS: RailItem[] = [
  { id: 'devices', icon: 'devices', label: 'Devices' },
  { id: 'routing', icon: 'routes', label: 'Routing' },
  { id: 'scan', icon: 'scan', label: 'Scan' },
];
const BOTTOM_ITEMS: RailItem[] = [
  { id: 'settings', icon: 'settings', label: 'Settings' },
  { id: 'account', icon: 'logout', label: 'Account' },
];

const SECTION_TITLES: Record<SectionId, string> = {
  devices: 'Devices',
  routing: 'Routing',
  scan: 'Scan page',
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
  | { kind: 'shell'; settings: RouterSettings; section: SectionId };

function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });

  useEffect(() => {
    // The section is loaded together with the connection so the popup opens
    // straight where the user left it, without flashing the default one.
    Promise.all([loadConnection(), loadSection()]).then(([state, section]) => {
      switch (state.status) {
        case 'connected':
          void ensureOriginStripRule(state.settings.origin);
          setScreen({ kind: 'shell', settings: state.settings, section });
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
          onConnected={(settings) => setScreen({ kind: 'shell', settings, section: 'devices' })}
        />
      );
    case 'shell':
      return (
        <Shell
          settings={screen.settings}
          initialSection={screen.section}
          onLoggedOut={() => setScreen({ kind: 'connect' })}
        />
      );
  }
}

function Shell({
  settings,
  initialSection,
  onLoggedOut,
}: {
  settings: RouterSettings;
  initialSection: SectionId;
  onLoggedOut: () => void;
}) {
  const [section, setSection] = useState<SectionId>(initialSection);
  // Section history for the mouse side buttons (back/forward).
  const past = useRef<SectionId[]>([]);
  const future = useRef<SectionId[]>([]);
  const current = useRef(section);

  function show(next: SectionId) {
    current.current = next;
    setSection(next);
    saveSection(next);
  }

  function select(next: SectionId) {
    if (next === current.current) return;
    past.current.push(current.current);
    future.current = [];
    show(next);
  }

  useEffect(() => {
    const onMouseUp = (e: MouseEvent) => {
      // 3 / 4 = the mouse back / forward side buttons.
      if (e.button === 3) {
        e.preventDefault();
        // An open inner screen (editor, scan picker) consumes back first.
        if (!dispatchBack() && past.current.length > 0) {
          future.current.push(current.current);
          show(past.current.pop()!);
        }
      } else if (e.button === 4) {
        e.preventDefault();
        if (future.current.length > 0) {
          past.current.push(current.current);
          show(future.current.pop()!);
        }
      }
    };
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, []);

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
          onSelect={(id) => select(id as SectionId)}
        />
        <main className="shell__content">
          {section === 'devices' && <DevicesScreen settings={settings} />}
          {section === 'routing' && <RoutingScreen settings={settings} />}
          {section === 'scan' && <ScanScreen settings={settings} />}
          {section === 'settings' && <SettingsScreen settings={settings} />}
          {section === 'account' && <AccountScreen settings={settings} onLoggedOut={onLoggedOut} />}
        </main>
      </div>
    </div>
  );
}

export default App;
