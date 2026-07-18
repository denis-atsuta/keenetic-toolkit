import { useEffect, useState } from 'react';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { HelpTip } from '@/components/ui/HelpTip';
import { Icon } from '@/components/ui/Icon';
import {
  connectRouter,
  disconnectRouter,
  fetchFirmwareVersion,
  isUnsupportedFirmware,
  testRouter,
} from '@/utils/keenetic/setup';
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

type TestState = { status: 'idle' | 'busy' | 'ok' } | { status: 'fail'; message: string };

interface ConnectDraft {
  address: string;
  login: string;
  password: string;
  remember: boolean;
}

// The permission prompt spawned by Test/Connect closes the popup, so the
// form is drafted to session storage and restored on the next open.
const connectDraft = storage.defineItem<ConnectDraft | null>('session:connectDraft', {
  fallback: null,
});

export function ConnectScreen({ onConnected, initial, locked }: ConnectScreenProps) {
  const [address, setAddress] = useState(initial?.address ?? 'my.keenetic.net');
  const [login, setLogin] = useState(initial?.login ?? 'admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [test, setTest] = useState<TestState>({ status: 'idle' });
  const [hydrated, setHydrated] = useState(false);
  const [warning, setWarning] = useState<{ settings: RouterSettings; version: string } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    void connectDraft.getValue().then((draft) => {
      if (cancelled) return;
      if (draft) {
        setAddress(draft.address);
        setLogin(draft.login);
        setPassword(draft.password);
        setRemember(draft.remember);
      }
      setHydrated(true);
      // Auto-check the prefilled address; runs only when its host permission
      // is already granted, so no Chrome prompt can pop up on open.
      void runTest(draft?.address ?? initial?.address ?? 'my.keenetic.net', false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only hydration
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void connectDraft.setValue({ address, login, password, remember });
  }, [hydrated, address, login, password, remember]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const settings = await connectRouter(address, login, password, remember);
      let version: string | null = null;
      try {
        version = await fetchFirmwareVersion(settings);
      } catch {
        // Version endpoint hiccup should not fail the whole connect.
      }
      if (version && isUnsupportedFirmware(version)) {
        setWarning({ settings, version });
        return;
      }
      await connectDraft.removeValue();
      onConnected(settings);
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

  async function runTest(addr: string, interactive = true) {
    setTest({ status: 'busy' });
    try {
      const probed = await testRouter(addr, interactive);
      setTest(probed ? { status: 'ok' } : { status: 'idle' });
    } catch (e) {
      const unreachable =
        e instanceof TypeError || (e instanceof DOMException && e.name === 'TimeoutError');
      setTest({
        status: 'fail',
        message: unreachable
          ? 'No response at this address.'
          : e instanceof Error
            ? e.message
            : String(e),
      });
    }
  }

  async function confirmWarning() {
    if (!warning) return;
    await connectDraft.removeValue();
    onConnected(warning.settings);
  }

  async function cancelWarning() {
    if (!warning) return;
    setWarning(null);
    // Undo the just-made connection: clear stored credentials, the DNR rule
    // and the host permission, returning to a clean slate.
    await disconnectRouter(warning.settings.origin);
  }

  if (warning) {
    return (
      <div className="connect">
        <div className="connect__brand">
          <img className="connect__logo" src="/icon/96.png" alt="" />
          <span>
            <b>Keenetic</b> Toolkit
          </span>
        </div>
        <h1 className="connect__title">Unsupported firmware</h1>
        <p className="hint">
          This router runs KeeneticOS {warning.version}. The extension is tested on 5.1 and newer
          only — on older firmware some features may work incorrectly or not at all.
        </p>
        <Button onClick={() => void confirmWarning()}>Connect anyway</Button>
        <Button variant="outline" onClick={() => void cancelWarning()}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <form
      className="connect"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="connect__brand">
        <img className="connect__logo" src="/icon/96.png" alt="" />
        <span>
          <b>Keenetic</b> Toolkit
        </span>
      </div>
      <h1 className="connect__title">{locked ? 'Unlock router' : 'Connect to router'}</h1>
      {locked && <p className="hint">Session ended — re-enter the password to continue.</p>}
      <div className="connect__row">
        <TextField
          label="Router address"
          value={address}
          onChange={(v) => {
            setAddress(v);
            setTest({ status: 'idle' });
          }}
          required
          trailing={
            <button
              type="button"
              className={test.status === 'ok' ? 'field__btn field__btn--ok' : 'field__btn'}
              title={test.status === 'ok' ? 'Keenetic router found' : 'Test the connection'}
              disabled={test.status === 'busy'}
              onClick={() => void runTest(address)}
            >
              {test.status === 'busy' ? (
                <Icon name="loader" size={18} className="spin" />
              ) : test.status === 'ok' ? (
                <Icon name="check" size={18} />
              ) : (
                <Icon name="pulse" size={18} />
              )}
            </button>
          }
        />
        <HelpTip>
          Leave the default my.keenetic.net — it resolves to your router on most setups. If it does
          not respond, try the router&apos;s LAN address (usually 192.168.1.1 or 192.168.0.1) or the
          address you open the router&apos;s web interface at.
        </HelpTip>
      </div>
      {test.status === 'fail' && <p className="error connect__test-fail">{test.message}</p>}
      <div className="connect__row">
        <TextField label="Login" value={login} onChange={setLogin} required />
        <HelpTip>
          Consider creating a separate router user just for the extension, with only the &quot;Web
          configurator&quot; access right — so your main account stays out of the browser.
        </HelpTip>
      </div>
      <div className="connect__row">
        <TextField
          label="Password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={setPassword}
          autoFocus={locked}
          required
          trailing={
            <button
              type="button"
              className="field__btn"
              title={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((s) => !s)}
            >
              <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} />
            </button>
          }
        />
        <HelpTip>
          Sent only to the router during sign-in. The extension never stores the password itself —
          only a derived hash (see &quot;Remember&quot; below).
        </HelpTip>
      </div>
      <div className="connect__remember">
        <Checkbox checked={remember} onChange={setRemember}>
          Remember on this device
        </Checkbox>
        <HelpTip>
          Your password is never stored — only a hash of it. By default that hash is kept in memory
          and cleared when the browser closes; turn this on to store it on this device so you stay
          signed in after a restart. Note: the hash is kept unencrypted in the extension storage,
          and anyone who obtains it can sign in to the router — by turning this on you accept that
          risk.
        </HelpTip>
      </div>
      {error && <p className="error">{error}</p>}
      <Button type="submit" disabled={busy}>
        {busy ? 'Connecting…' : locked ? 'Unlock' : 'Connect'}
      </Button>
    </form>
  );
}
