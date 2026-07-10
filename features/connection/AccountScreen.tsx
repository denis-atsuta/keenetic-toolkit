import { Button } from '@/components/ui/Button';
import { disconnectRouter } from '@/utils/keenetic/setup';
import type { RouterSettings } from '@/utils/settings';
import './Connection.css';

export function AccountScreen({
  settings,
  onLoggedOut,
}: {
  settings: RouterSettings;
  onLoggedOut: () => void;
}) {
  async function logout() {
    await disconnectRouter(settings.origin);
    onLoggedOut();
  }

  return (
    <div className="account">
      <dl className="account__details">
        <dt>Model</dt>
        <dd>{settings.realm}</dd>
        <dt>Address</dt>
        <dd>{settings.origin}</dd>
        <dt>Login</dt>
        <dd>{settings.login}</dd>
      </dl>
      <Button variant="outline" onClick={() => void logout()}>
        Log out
      </Button>
      <p className="hint">Logging out removes the stored credentials from this browser.</p>
    </div>
  );
}
