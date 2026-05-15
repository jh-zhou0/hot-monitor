'use client';

import { ReactNode } from 'react';

interface NeonTextProps {
  children: ReactNode;
  color?: 'cyan' | 'magenta' | 'green' | 'yellow';
  as?: 'h1' | 'h2' | 'h3' | 'span' | 'p';
  className?: string;
  flicker?: boolean;
}

const colorClass = {
  cyan: 'neon-text-cyan',
  magenta: 'neon-text-magenta',
  green: 'neon-text-green',
  yellow: 'text-neon-yellow',
};

export function NeonText({ children, color = 'cyan', as: Tag = 'span', className = '', flicker = false }: NeonTextProps) {
  return (
    <Tag className={`font-display ${colorClass[color]} ${flicker ? 'animate-flicker' : ''} ${className}`}>
      {children}
    </Tag>
  );
}
