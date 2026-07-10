import * as RSelect from '@radix-ui/react-select';
import './Select.css';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
  className?: string;
}

/**
 * Keenetic-styled dropdown. Radix provides the accessible behaviour (portal,
 * collision-aware positioning, keyboard, focus) and we skin it to match the
 * router's own "ndw-select": outlined control with a caret and a floating
 * menu whose selected item is highlighted.
 */
export function Select({
  value,
  options,
  onChange,
  disabled,
  title,
  ariaLabel,
  className,
}: SelectProps) {
  return (
    <div className={`select ${className ?? ''}`}>
      <RSelect.Root value={value} onValueChange={onChange} disabled={disabled}>
        <RSelect.Trigger className="select__control" title={title} aria-label={ariaLabel}>
          <RSelect.Value />
          <RSelect.Icon className="select__caret">
            <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">
              <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </RSelect.Icon>
        </RSelect.Trigger>
        <RSelect.Portal>
          <RSelect.Content className="select-menu" position="popper" sideOffset={4} align="start">
            <RSelect.Viewport>
              {options.map((o) => (
                <RSelect.Item key={o.value} value={o.value} className="select-menu__item">
                  <RSelect.ItemText>{o.label}</RSelect.ItemText>
                </RSelect.Item>
              ))}
            </RSelect.Viewport>
          </RSelect.Content>
        </RSelect.Portal>
      </RSelect.Root>
    </div>
  );
}
