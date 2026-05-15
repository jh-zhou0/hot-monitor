'use client';

import { useState, useEffect } from 'react';
import { NavBar } from '@/components/nav-bar';
import { ParticleBg } from '@/components/ui/particle-bg';
import { CyberCard } from '@/components/ui/cyber-card';
import { CyberButton } from '@/components/ui/cyber-button';
import { CyberInput } from '@/components/ui/cyber-input';
import { NeonText } from '@/components/ui/neon-text';
import { NotificationSettings } from '@/types';

export default function SettingsPage() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    const res = await fetch('/api/notifications/settings');
    if (res.ok) {
      const data = await res.json();
      setSettings(data.settings);
    }
  }

  async function saveSettings() {
    if (!settings) return;
    setSaving(true);
    await fetch('/api/notifications/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    setSaving(false);
  }

  if (!settings) {
    return (
      <>
        <ParticleBg />
        <NavBar />
        <main className="relative z-10 max-w-4xl mx-auto px-4 py-6">
          <div className="h-40 bg-bg-secondary rounded-lg animate-pulse" />
        </main>
      </>
    );
  }

  return (
    <>
      <ParticleBg />
      <NavBar />

      <main className="relative z-10 max-w-4xl mx-auto px-4 py-6">
        <NeonText as="h1" color="cyan" className="text-xl mb-6">
          通知设置
        </NeonText>

        {/* 实时推送说明 */}
        <CyberCard className="mb-4">
          <h3 className="text-sm font-medium text-text-primary mb-3">实时推送通知</h3>
          <p className="text-xs text-text-muted">
            系统通过 WebSocket 实时推送热点通知。只要页面保持打开，发现新热点时会立即弹出提醒。
          </p>
          <div className="mt-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-neon-green animate-neon-pulse" />
            <span className="text-xs text-neon-green">连接中</span>
          </div>
        </CyberCard>

        {/* 邮件通知 */}
        <CyberCard className="mb-4">
          <h3 className="text-sm font-medium text-text-primary mb-3">邮件通知</h3>
          <div className="flex items-center gap-3 mb-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!settings.email_enabled}
                onChange={(e) => setSettings({ ...settings, email_enabled: e.target.checked ? 1 : 0 })}
                className="accent-[#00f5ff]"
              />
              <span className="text-xs text-text-muted">启用邮件通知</span>
            </label>
          </div>
          {settings.email_enabled ? (
            <CyberInput
              label="通知邮箱"
              type="email"
              value={settings.email || ''}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              placeholder="your@email.com"
            />
          ) : null}
        </CyberCard>

        {/* 推送阈值 */}
        <CyberCard className="mb-4">
          <h3 className="text-sm font-medium text-text-primary mb-3">推送阈值</h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-muted">最低评分:</span>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.min_score}
              onChange={(e) => setSettings({ ...settings, min_score: Number(e.target.value) })}
              className="flex-1 accent-[#00f5ff]"
            />
            <span className="text-sm font-display text-neon-cyan w-8 text-right">{settings.min_score}</span>
          </div>
          <p className="text-[10px] text-text-dim mt-1">只有评分 ≥ {settings.min_score} 的热点才会推送通知</p>
        </CyberCard>

        {/* 免打扰 */}
        <CyberCard className="mb-6">
          <h3 className="text-sm font-medium text-text-primary mb-3">免打扰时段</h3>
          <div className="flex items-center gap-3">
            <CyberInput
              type="time"
              value={settings.quiet_hours_start || ''}
              onChange={(e) => setSettings({ ...settings, quiet_hours_start: e.target.value })}
              className="w-32"
            />
            <span className="text-text-muted text-xs">至</span>
            <CyberInput
              type="time"
              value={settings.quiet_hours_end || ''}
              onChange={(e) => setSettings({ ...settings, quiet_hours_end: e.target.value })}
              className="w-32"
            />
          </div>
        </CyberCard>

        <CyberButton onClick={saveSettings} disabled={saving} size="lg" className="w-full">
          {saving ? '保存中...' : '保存设置'}
        </CyberButton>
      </main>
    </>
  );
}
