import type { ReactNode } from 'react';
import './Checkbox.css';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}

/** Keenetic-style checkbox: a square that fills with the accent when checked. */
export function Checkbox({ checked, onChange, children }: CheckboxProps) {
  return (
    <label className="checkbox">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="checkbox__box" aria-hidden="true">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M2.5 6.2l2.3 2.3L9.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="checkbox__label">{children}</span>
    </label>
  );
}
