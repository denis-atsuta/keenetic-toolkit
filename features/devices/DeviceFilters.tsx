import { Icon } from '@/components/ui/Icon';
import type { DeviceFilter, StatusFilter } from './filter';

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'online', label: 'Online' },
  { value: 'unregistered', label: 'New' },
];

interface DeviceFiltersProps {
  filter: DeviceFilter;
  onChange: (filter: DeviceFilter) => void;
}

export function DeviceFilters({ filter, onChange }: DeviceFiltersProps) {
  return (
    <div className="device-filters">
      <div className="search">
        <Icon name="search" size={16} className="search__icon" />
        <input
          className="search__input"
          type="search"
          placeholder="Search by name, IP or MAC"
          value={filter.query}
          onChange={(e) => onChange({ ...filter, query: e.target.value })}
        />
      </div>
      <div className="segmented" role="tablist">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={filter.status === tab.value}
            className={`segmented__item ${filter.status === tab.value ? 'segmented__item--active' : ''}`}
            onClick={() => onChange({ ...filter, status: tab.value })}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
