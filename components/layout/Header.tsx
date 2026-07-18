import { Icon } from '../ui/Icon';
import './Header.css';

interface HeaderProps {
  title: string;
  subtitle?: string;
  /** When set, renders an "open in resizable window" button. */
  onExpand?: () => void;
}

/** Brand bar rendering the router model like the web UI logo. */
export function Header({ title, subtitle, onExpand }: HeaderProps) {
  const [first, ...rest] = title.split(' ');
  return (
    <header className="header">
      <div className="header__left">
        <img className="header__logo" src="/icon/96.png" alt="" />
        <h1 className="brand">
          <b>{first}</b>
          {rest.length > 0 && ` ${rest.join(' ')}`}
        </h1>
      </div>
      <div className="header__right">
        {subtitle && <span className="header__subtitle">{subtitle}</span>}
        {onExpand && (
          <button
            type="button"
            className="header__action"
            title="Open in a resizable window"
            onClick={onExpand}
          >
            <Icon name="expand" size={16} />
          </button>
        )}
      </div>
    </header>
  );
}
