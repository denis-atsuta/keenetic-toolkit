import { useEffect, useState } from 'react';
import { connectRouter } from '@/utils/keenetic/setup';
import { KeeneticAuthError } from '@/utils/keenetic/client';
import { ensureOriginStripRule } from '@/utils/keenetic/origin-fix';
import { routerSettings, type RouterSettings } from '@/utils/settings';
import './App.css';

type View = { kind: 'loading' } | { kind: 'setup' } | { kind: 'connected'; settings: RouterSettings };

function App() {
  const [view, setView] = useState<View>({ kind: 'loading' });

  useEffect(() => {
    routerSettings.getValue().then((settings) => {
      // Belt and braces: the background script also registers this on start.
      if (settings) void ensureOriginStripRule(settings.origin);
      setView(settings ? { kind: 'connected', settings } : { kind: 'setup' });
    });
  }, []);

  switch (view.kind) {
    case 'loading':
      return null;
    case 'setup':
      return <SetupForm onConnected={(settings) => setView({ kind: 'connected', settings })} />;
    case 'connected':
      return (
        <ConnectedView settings={view.settings} onReconfigure={() => setView({ kind: 'setup' })} />
      );
  }
}

function SetupForm({ onConnected }: { onConnected: (settings: RouterSettings) => void }) {
  const [address, setAddress] = useState('my.keenetic.net');
  const [login, setLogin] = useState('admin');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      onConnected(await connectRouter(address, login, password));
    } catch (e) {
      setError(
        e instanceof KeeneticAuthError
          ? 'The router rejected the login or password.'
          : e instanceof Error
            ? e.message
            : String(e),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="panel"
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit();
      }}
    >
      <h1>Connect to router</h1>
      <label>
        Router address
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="my.keenetic.net or 192.168.1.1"
          required
        />
      </label>
      <label>
        Login
        <input value={login} onChange={(e) => setLogin(e.target.value)} required />
      </label>
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={busy}>
        {busy ? 'Connecting…' : 'Connect'}
      </button>
      <p className="hint">
        Only a derived hash of the password is stored; all requests go directly to the router.
      </p>
    </form>
  );
}

function ConnectedView({
  settings,
  onReconfigure,
}: {
  settings: RouterSettings;
  onReconfigure: () => void;
}) {
  return (
    <div className="panel">
      <h1>{settings.realm}</h1>
      <p className="status-ok">Connected</p>
      <dl className="details">
        <dt>Address</dt>
        <dd>{settings.origin}</dd>
        <dt>Login</dt>
        <dd>{settings.login}</dd>
      </dl>
      <button onClick={onReconfigure}>Change connection…</button>
    </div>
  );
}

export default App;
