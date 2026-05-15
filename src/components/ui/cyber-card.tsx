'use client';

import { ReactNode } from 'react';

interface CyberCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: 'cyan' | 'magenta' | 'green' | 'red';
  hover?: boolean;
}

const glowMap = {
  cyan: 'border-neon-cyan/30 hover:border-neon-cyan/60 hover:shadow-[0_0_15px_rgba(0,245,255,0.3)]',
  magenta: 'border-neon-magenta/30 hover:border-neon-magenta/60 hover:shadow-[0_0_15px_rgba(255,0,255,0.3)]',
  green: 'border-neon-green/30 hover:border-neon-green/60 hover:shadow-[0_0_15px_rgba(0,255,136,0.3)]',
  red: 'border-neon-red/30 hover:border-neon-red/60 hover:shadow-[0_0_15px_rgba(255,51,102,0.3)]',
};

export function CyberCard({ children, className = '', glowColor = 'cyan', hover = true }: CyberCardProps) {
  return (
    <div
      className={`
        relative bg-bg-card border rounded-lg p-4
        transition-all duration-300
        ${hover ? glowMap[glowColor] : `border-${glowColor === 'cyan' ? 'neon-cyan' : glowColor === 'magenta' ? 'neon-magenta' : glowColor === 'green' ? 'neon-green' : 'neon-red'}/20`}
        ${className}
      `}
    >
      <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
