'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { NeonText } from './ui/neon-text';
import { useSocket } from '@/lib/hooks/use-socket';

const navItems = [
  { href: '/', label: '热点雷达', icon: '◈' },
  { href: '/keywords', label: '监控词', icon: '⟡' },
  { href: '/settings', label: '设置', icon: '⚙' },
];

export function NavBar() {
  const pathname = usePathname();
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { connected, notifications, unreadCount, clearUnread, clearNotifications } = useSocket();

  // 点击面板外关闭
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [notifOpen]);

  function toggleNotif() {
    setNotifOpen((v) => !v);
    if (!notifOpen) clearUnread();
  }

  async function handleTrigger() {
    setTriggering(true);
    setTriggerMsg('');
    try {
      const res = await fetch('/api/monitor/trigger', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setTriggerMsg(`+${data.count}`);
        setTimeout(() => setTriggerMsg(''), 3000);
        window.dispatchEvent(new CustomEvent('hotspot-refresh'));
      }
    } catch {
      setTriggerMsg('失败');
      setTimeout(() => setTriggerMsg(''), 3000);
    } finally {
      setTriggering(false);
    }
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-neon-cyan/10 bg-bg-primary/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 rounded border border-neon-cyan/50 flex items-center justify-center animate-glow-border">
            <span className="text-neon-cyan text-sm">⚡</span>
          </div>
          <NeonText as="span" color="cyan" className="text-sm font-bold tracking-wider hidden sm:inline">
            HOT MONITOR
          </NeonText>
        </Link>

        {/* 导航 */}
        <div className="flex items-center gap-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}
              className={`px-3 py-1.5 rounded text-xs font-mono transition-all duration-200
                ${pathname === item.href
                  ? 'text-neon-cyan bg-neon-cyan/10 border border-neon-cyan/30'
                  : 'text-text-muted hover:text-text-primary hover:bg-white/5'
                }`}
            >
              <span className="mr-1">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>

        {/* 右侧操作区 */}
        <div className="flex items-center gap-2">
          {/* 立即采集 */}
          <button onClick={handleTrigger} disabled={triggering}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded border border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan/10 hover:border-neon-cyan/70 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <span className={triggering ? 'animate-spin inline-block' : ''}>⚡</span>
            <span className="hidden sm:inline">{triggering ? '采集中' : '立即采集'}</span>
            {triggerMsg && <span className="text-neon-green font-bold">{triggerMsg}</span>}
          </button>

          {/* 通知按钮 */}
          <div className="relative" ref={panelRef}>
            <button onClick={toggleNotif}
              className={`relative w-8 h-8 flex items-center justify-center rounded border transition-all cursor-pointer
                ${notifOpen
                  ? 'border-neon-magenta/60 bg-neon-magenta/10 text-neon-magenta'
                  : 'border-white/10 text-text-muted hover:border-white/25 hover:text-text-primary'
                }`}
            >
              <span className="text-sm">🔔</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-neon-red text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* 通知面板 */}
            {notifOpen && (
              <div className="absolute right-0 top-10 w-80 bg-bg-secondary border border-neon-magenta/20 rounded-lg shadow-[0_0_30px_rgba(255,0,255,0.15)] overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
                  <span className="text-xs font-mono text-text-primary font-bold">通知中心</span>
                  {notifications.length > 0 && (
                    <button onClick={clearNotifications}
                      className="text-[10px] text-text-muted hover:text-neon-red transition-colors cursor-pointer">
                      清空
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-text-dim text-xs font-mono">
                      暂无通知
                    </div>
                  ) : (
                    notifications.map((n, i) => (
                      <div key={i}
                        className="px-3 py-2.5 border-b border-white/5 hover:bg-white/3 transition-colors">
                        <div className="flex items-start gap-2">
                          <span className={`text-xs flex-shrink-0 mt-0.5 ${n.score >= 80 ? 'text-neon-yellow' : 'text-neon-cyan'}`}>
                            {n.score >= 80 ? '⚡' : '◈'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className={`text-[9px] font-mono font-bold border px-1 py-0.5 rounded
                                ${n.score >= 80 ? 'text-neon-yellow border-neon-yellow/30' :
                                  n.score >= 50 ? 'text-neon-cyan border-neon-cyan/30' :
                                  'text-text-muted border-white/15'}`}>
                                {n.score >= 80 ? '高' : n.score >= 50 ? '中' : '低'} {n.score}分
                              </span>
                              <span className="text-[9px] text-text-dim">{getTimeAgo(n.receivedAt)}</span>
                            </div>
                            <p className="text-xs text-text-primary line-clamp-2 leading-snug">{n.title}</p>
                            {n.summary && (
                              <p className="text-[10px] text-text-muted mt-0.5 line-clamp-1">{n.summary}</p>
                            )}
                            {n.sourceUrl && (
                              <a href={n.sourceUrl} target="_blank" rel="noopener noreferrer"
                                className="text-[10px] text-neon-cyan/50 hover:text-neon-cyan mt-0.5 inline-block">
                                查看原文 →
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 连接状态 */}
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-neon-green animate-neon-pulse' : 'bg-neon-red'}`} />
            <span className="text-[10px] text-text-muted hidden sm:inline">{connected ? 'LIVE' : 'OFF'}</span>
          </div>
        </div>
      </div>
    </nav>
  );
}

function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  return `${Math.floor(diff / 86400)}天前`;
}
