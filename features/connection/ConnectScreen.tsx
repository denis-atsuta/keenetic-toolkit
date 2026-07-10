import { useState } from 'react';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { connectRouter } from '@/utils/keenetic/setup';
import { KeeneticAuthError } from '@/utils/keenetic/client';
import type { RouterSettings } from '@/utils/settings';
import './Connection.css';

export function ConnectScreen({
  onConnected,
}: {
  onConnected: (settings: RouterSettings) => void;
}) {
  const [address, setAddress] = useState('my.keenetic.net');
  const [login, setLogin] = useState('admin');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
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
      className="connect"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h1 className="connect__title">Connect to router</h1>
      <TextField label="Router address" value={address} onChange={setAddress} required />
      <TextField label="Login" value={login} onChange={setLogin} required />
      <TextField label="Password" type="password" value={password} onChange={setPassword} required />
      {error && <p className="error">{error}</p>}
      <Button type="submit" disabled={busy}>
        {busy ? 'Connecting…' : 'Connect'}
      </Button>
      <p className="hint">
        Only a derived hash of the password is stored; all requests go directly to the router.
      </p>
    </form>
  );
}
