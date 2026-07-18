import { useState } from 'react';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { HelpTip } from '@/components/ui/HelpTip';
import { connectRouter } from '@/utils/keenetic/setup';
import { KeeneticAuthError } from '@/utils/keenetic/client';
import type { RouterSettings } from '@/utils/settings';
import './Connection.css';

interface ConnectScreenProps {
  onConnected: (settings: RouterSettings) => void;
  /** Prefilled address/login when reconnecting after the session was cleared. */
  initial?: { address: string; login: string };
  /** True when the in-memory session expired and only the password is needed. */
  locked?: boolean;
}

export function ConnectScreen({ onConnected, initial, locked }: ConnectScreenProps) {
  const [address, setAddress] = useState(initial?.address ?? 'my.keenetic.net');
  const [login, setLogin] = useState(initial?.login ?? 'admin');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      onConnected(await connectRouter(address, login, password, remember));
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
      <h1 className="connect__title">{locked ? 'Unlock router' : 'Connect to router'}</h1>
      {locked && <p className="hint">Session ended — re-enter the password to continue.</p>}
      <TextField label="Router address" value={address} onChange={setAddress} required />
      <TextField label="Login" value={login} onChange={setLogin} required />
      <TextField
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        autoFocus={locked}
        required
      />
      <div className="connect__remember">
        <Checkbox checked={remember} onChange={setRemember}>
          Remember on this device
        </Checkbox>
        <HelpTip>
          Your password is never stored — only a hash of it. By default that hash is kept in memory
          and cleared when the browser closes; turn this on to store it on this device so you stay
          signed in after a restart.
        </HelpTip>
      </div>
      {error && <p className="error">{error}</p>}
      <Button type="submit" disabled={busy}>
        {busy ? 'Connecting…' : locked ? 'Unlock' : 'Connect'}
      </Button>
    </form>
  );
}
