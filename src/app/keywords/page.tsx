'use client';

import { useState, useEffect } from 'react';
import { NavBar } from '@/components/nav-bar';
import { ParticleBg } from '@/components/ui/particle-bg';
import { CyberCard } from '@/components/ui/cyber-card';
import { CyberButton } from '@/components/ui/cyber-button';
import { CyberInput } from '@/components/ui/cyber-input';
import { NeonText } from '@/components/ui/neon-text';
import { Keyword } from '@/types';

const CATEGORIES = [
  { value: 'model', label: '大模型' },
  { value: 'tool', label: '工具' },
  { value: 'research', label: '研究' },
  { value: 'general', label: '通用' },
];

export default function KeywordsPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [newInterval, setNewInterval] = useState(60);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchKeywords();
  }, []);

  async function fetchKeywords() {
    try {
      const res = await fetch('/api/keywords');
      if (res.ok) {
        const data = await res.json();
        setKeywords(data.keywords || []);
      }
    } catch (e) {
      console.error('Failed to fetch keywords:', e);
    } finally {
      setLoading(false);
    }
  }

  async function addKeyword() {
    if (!newKeyword.trim()) return;

    const res = await fetch('/api/keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: newKeyword.trim(),
        category: newCategory,
        check_interval: newInterval,
      }),
    });

    if (res.ok) {
      setNewKeyword('');
      fetchKeywords();
    }
  }

  async function toggleKeyword(id: number, isActive: number) {
    await fetch('/api/keywords', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: isActive ? 0 : 1 }),
    });
    fetchKeywords();
  }

  async function deleteKeyword(id: number) {
    await fetch(`/api/keywords?id=${id}`, { method: 'DELETE' });
    fetchKeywords();
  }

  return (
    <>
      <ParticleBg />
      <NavBar />

      <main className="relative z-10 max-w-4xl mx-auto px-4 py-6">
        <NeonText as="h1" color="cyan" className="text-xl mb-6">
          监控关键词管理
        </NeonText>

        {/* 添加关键词 */}
        <CyberCard className="mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <CyberInput
                placeholder="输入监控关键词，如 GPT-5、Claude..."
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
              />
            </div>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="bg-bg-secondary border border-neon-cyan/20 rounded px-3 py-2 text-sm text-text-primary font-mono focus:outline-none focus:border-neon-cyan/60"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={5}
                max={1440}
                value={newInterval}
                onChange={(e) => setNewInterval(Number(e.target.value))}
                className="w-16 bg-bg-secondary border border-neon-cyan/20 rounded px-2 py-2 text-sm text-text-primary font-mono text-center focus:outline-none focus:border-neon-cyan/60"
              />
              <span className="text-xs text-text-muted">分钟</span>
            </div>
            <CyberButton onClick={addKeyword} disabled={!newKeyword.trim()}>
              + 添加
            </CyberButton>
          </div>
        </CyberCard>

        {/* 关键词列表 */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-bg-secondary rounded-lg animate-pulse border border-white/5" />
            ))}
          </div>
        ) : keywords.length === 0 ? (
          <CyberCard className="text-center py-8">
            <p className="text-text-muted">还没有监控关键词，添加一个开始吧</p>
          </CyberCard>
        ) : (
          <div className="space-y-2">
            {keywords.map((kw) => (
              <CyberCard key={kw.id} glowColor={kw.is_active ? 'cyan' : 'red'} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${kw.is_active ? 'bg-neon-green animate-neon-pulse' : 'bg-neon-red/50'}`}
                  />
                  <span className="text-sm font-medium">{kw.keyword}</span>
                  <span className="text-[10px] text-text-dim border border-text-dim/30 px-1.5 py-0.5 rounded">
                    {CATEGORIES.find(c => c.value === kw.category)?.label || kw.category}
                  </span>
                  <span className="text-[10px] text-text-dim">{kw.check_interval}分</span>
                </div>
                <div className="flex items-center gap-2">
                  <CyberButton
                    size="sm"
                    variant={kw.is_active ? 'secondary' : 'primary'}
                    onClick={() => toggleKeyword(kw.id, kw.is_active)}
                  >
                    {kw.is_active ? '暂停' : '启用'}
                  </CyberButton>
                  <CyberButton
                    size="sm"
                    variant="danger"
                    onClick={() => deleteKeyword(kw.id)}
                  >
                    删除
                  </CyberButton>
                </div>
              </CyberCard>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
