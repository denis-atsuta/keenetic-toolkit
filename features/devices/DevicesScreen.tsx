import type { RouterSettings } from '@/utils/settings';
import { useDevices } from './useDevices';
import { useFavorites } from './useFavorites';
import { useDeviceFilter } from './useDeviceFilter';
import { useHiddenPolicies } from '../settings/useHiddenPolicies';
import { DeviceFilters } from './DeviceFilters';
import { DeviceRow } from './DeviceRow';
import { buildPolicyOptions } from './policyState';
import { filterAndSortHosts } from './filter';
import './DevicesScreen.css';

export function DevicesScreen({ settings }: { settings: RouterSettings }) {
  const { data, error, saving, changeState, register } = useDevices(settings);
  const { favorites, toggle } = useFavorites(settings.origin);
  const { hidden } = useHiddenPolicies(settings.origin);
  const [filter, setFilter] = useDeviceFilter();

  if (error && !data) return <p className="screen-msg error">{error}</p>;
  if (!data) return <p className="screen-msg hint">Loading devices…</p>;

  const options = buildPolicyOptions(data.policies);
  const visible = filterAndSortHosts(data.hosts, favorites, filter);

  return (
    <div className="devices">
      <DeviceFilters filter={filter} onChange={setFilter} />
      {error && <p className="error devices__error">{error}</p>}
      {visible.length === 0 ? (
        <p className="screen-msg hint">No devices match the filter.</p>
      ) : (
        <ul className="host-list">
          {visible.map((host) => (
            <DeviceRow
              key={host.mac}
              host={host}
              state={data.states[host.mac]}
              options={options}
              hidden={hidden}
              saving={saving.has(host.mac)}
              favorite={favorites.has(host.mac)}
              onToggleFavorite={(mac) => void toggle(mac)}
              onChange={(mac, state) => void changeState(mac, state)}
              onRegister={(mac) => void register(mac)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
