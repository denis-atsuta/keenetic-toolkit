import { Toggle } from '@/components/ui/Toggle';
import type { RouterSettings } from '@/utils/settings';
import { useDevices } from '../devices/useDevices';
import { buildPolicyOptions } from '../devices/policyState';
import { useHiddenPolicies } from './useHiddenPolicies';
import './SettingsScreen.css';

export function SettingsScreen({ settings }: { settings: RouterSettings }) {
  const { data, error } = useDevices(settings);
  const { hidden, toggle } = useHiddenPolicies(settings.origin);

  if (error && !data) return <p className="screen-msg error">{error}</p>;
  if (!data) return <p className="screen-msg hint">Loading policies…</p>;

  return (
    <div className="settings">
      <section className="settings__section">
        <h3 className="settings__title">Device policies</h3>
        <p className="settings__hint">
          Choose which policies appear in the device selector. A device already using a hidden
          policy still shows it.
        </p>
        {buildPolicyOptions(data.policies).map((o) => (
          <div key={o.value} className="settings__row">
            <span className="settings__label">{o.label}</span>
            <Toggle
              checked={!hidden.has(o.value)}
              onChange={() => void toggle(o.value)}
              ariaLabel={`Show ${o.label}`}
            />
          </div>
        ))}
      </section>
    </div>
  );
}
