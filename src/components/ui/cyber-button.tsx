'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';

interface CyberButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

const variantStyles = {
  primary: 'border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/10 hover:shadow-[0_0_15px_rgba(0,245,255,0.3)]',
  secondary: 'border-neon-magenta/50 text-neon-magenta hover:bg-neon-magenta/10 hover:shadow-[0_0_15px_rgba(255,0,255,0.3)]',
  danger: 'border-neon-red/50 text-neon-red hover:bg-neon-red/10 hover:shadow-[0_0_15px_rgba(255,51,102,0.3)]',
};

const sizeStyles = {
  sm: 'px-3 py-1 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function CyberButton({ children, variant = 'primary', size = 'md', className = '', disabled, ...props }: CyberButtonProps) {
  return (
    <button
      className={`
        relative border rounded font-mono font-medium
        transition-all duration-200 cursor-pointer
        active:scale-95
        disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
