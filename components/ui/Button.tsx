import type { ButtonHTMLAttributes } from 'react';
import './Button.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'danger';
}

export function Button({ variant = 'primary', className, ...rest }: ButtonProps) {
  return <button className={`btn btn--${variant} ${className ?? ''}`} {...rest} />;
}
