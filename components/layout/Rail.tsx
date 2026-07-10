import { Icon, type IconName } from '../ui/Icon';
import './Rail.css';

export interface RailItem {
  id: string;
  icon: IconName;
  label: string;
}

interface RailProps {
  items: RailItem[];
  /** Rendered pinned at the bottom, e.g. logout. */
  bottomItems?: RailItem[];
  active: string;
  onSelect: (id: string) => void;
}

/** Slim vertical navigation, mirroring the web configurator's left menu. */
export function Rail({ items, bottomItems = [], active, onSelect }: RailProps) {
  const renderItem = (item: RailItem) => (
    <button
      key={item.id}
      type="button"
      className={`rail__item ${active === item.id ? 'rail__item--active' : ''}`}
      onClick={() => onSelect(item.id)}
      title={item.label}
    >
      <Icon name={item.icon} />
      <span className="rail__label">{item.label}</span>
    </button>
  );

  return (
    <nav className="rail">
      <div className="rail__group">{items.map(renderItem)}</div>
      {bottomItems.length > 0 && <div className="rail__group">{bottomItems.map(renderItem)}</div>}
    </nav>
  );
}
