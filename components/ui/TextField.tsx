import { useId } from 'react';
import './TextField.css';

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'password';
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
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
}: TextFieldProps) {
  const id = useId();
  return (
    <div className="field">
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
    </div>
  );
}
