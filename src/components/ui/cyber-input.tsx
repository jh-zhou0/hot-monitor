'use client';

import { InputHTMLAttributes } from 'react';

interface CyberInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function CyberInput({ label, className = '', ...props }: CyberInputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs text-text-muted font-mono uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        className={`
          bg-bg-secondary border border-neon-cyan/20 rounded px-3 py-2
          text-text-primary font-mono text-sm
          placeholder:text-text-dim
          focus:outline-none focus:border-neon-cyan/60
          focus:shadow-[0_0_10px_rgba(0,245,255,0.2)]
          transition-all duration-200
          ${className}
        `}
        {...props}
      />
    </div>
  );
}
