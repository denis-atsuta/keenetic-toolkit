import { useId, type ReactNode } from 'react';
import './TextField.css';

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'password';
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
  /** Content docked inside the field's right edge (a reveal toggle, an action). */
  trailing?: ReactNode;
}

/** Outlined input with a label notched into the top border (Keenetic style). */
export function TextField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
  autoFocus,
  trailing,
}: TextFieldProps) {
  const id = useId();
  return (
    <div className={trailing ? 'field field--trailing' : 'field'}>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
      />
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {trailing && <div className="field__trailing">{trailing}</div>}
    </div>
  );
}
