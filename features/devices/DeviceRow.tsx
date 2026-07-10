import { Select, type SelectOption } from '@/components/ui/Select';
import { Icon } from '@/components/ui/Icon';
import type { HotspotHost, PolicyState } from '@/utils/keenetic/api';
import { fromSelectValue, toSelectValue } from './policyState';

interface DeviceRowProps {
  host: HotspotHost;
  state: PolicyState | undefined;
  options: SelectOption[];
  saving: boolean;
  favorite: boolean;
  onToggleFavorite: (mac: string) => void;
  onChange: (mac: string, state: PolicyState) => void;
}

export function DeviceRow({
  host,
  state,
  options,
  saving,
  favorite,
  onToggleFavorite,
  onChange,
}: DeviceRowProps) {
  return (
    <li className="host-row">
      <button
        type="button"
        className={`host-fav ${favorite ? 'host-fav--on' : ''}`}
        title={favorite ? 'Remove from favorites' : 'Add to favorites'}
        aria-pressed={favorite}
        onClick={() => onToggleFavorite(host.mac)}
      >
        <Icon name={favorite ? 'star-filled' : 'star'} size={16} />
      </button>
      <span
        className={`presence ${host.active ? 'presence-on' : ''}`}
        title={host.active ? 'online' : 'offline'}
      />
      <span className="host-info">
        <span className="host-name">{host.name ?? host.mac}</span>
        <span className="host-ip">{host.ip ?? host.mac}</span>
      </span>
      <Select
        className="host-policy"
        value={toSelectValue(state)}
        options={options}
        disabled={saving || host.registered === false}
        title={
          host.registered === false
            ? 'Unregistered device — register it in the router UI first'
            : undefined
        }
        onChange={(v) => onChange(host.mac, fromSelectValue(v))}
      />
    </li>
  );
}
