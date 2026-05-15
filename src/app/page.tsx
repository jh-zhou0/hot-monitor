'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { NavBar } from '@/components/nav-bar';
import { ParticleBg } from '@/components/ui/particle-bg';
import { HotspotCard } from '@/components/hotspot-card';
import { CyberCard } from '@/components/ui/cyber-card';
import { NeonText } from '@/components/ui/neon-text';
import { useSocket } from '@/lib/hooks/use-socket';
import { Hotspot, Keyword, SourceType } from '@/types';

type CardFilter = 'all' | 'today' | 'urgent' | 'keyword';

const SOURCE_FILTERS: { value: SourceType | 'all'; label: string; icon: string }[] = [
  { value: 'all',        label: '全部来源',   icon: '◈' },
  { value: 'bing',       label: 'Bing',       icon: '🔍' },
  { value: 'duckduckgo', label: 'DuckDuckGo', icon: '🦆' },
  { value: 'google',     label: 'Google',     icon: 'G' },
  { value: 'sogou',      label: '搜狗',       icon: '搜' },
  { value: 'hackernews', label: 'HN',         icon: '▲' },
  { value: 'weibo',      label: '微博',       icon: '微' },
  { value: 'twitter',    label: 'Twitter',    icon: '𝕏' },
];

export default function HomePage() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardFilter, setCardFilter] = useState<CardFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceType | 'all'>('all');
  const [selectedKeyword, setSelectedKeyword] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({ total: 0, today: 0, urgent: 0, keywords: 0 });
  const [toast, setToast] = useState<{ title: string; score: number } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { notifications } = useSocket();

  const fetchHotspots = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '60' });

      // 卡片维度过滤
      if (cardFilter === 'today') {
        const d = new Date(); d.setHours(0, 0, 0, 0);
        params.set('since', d.toISOString());
      } else if (cardFilter === 'urgent') {
        params.set('min_score', '80');
      } else if (cardFilter === 'keyword' && selectedKeyword) {
        params.set('keyword_id', String(selectedKeyword));
      }

      // 来源维度过滤
      if (sourceFilter !== 'all') params.set('source_type', sourceFilter);

      // 关键词搜索
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/hotspots?${params}`);
      if (res.ok) {
        const data = await res.json();
        setHotspots(data.hotspots || []);
        setStats(data.stats || { total: 0, today: 0, urgent: 0, keywords: 0 });
      }
    } catch (e) {
      console.error('Failed to fetch hotspots:', e);
    } finally {
      setLoading(false);
    }
  }, [cardFilter, sourceFilter, selectedKeyword, search]);

  useEffect(() => {
    fetchHotspots();
    fetch('/api/keywords').then(r => r.json()).then(d => setKeywords(d.keywords || []));
  }, [fetchHotspots]);

  useEffect(() => {
    const handler = () => { setLoading(true); fetchHotspots(); };
    window.addEventListener('hotspot-refresh', handler);
    return () => window.removeEventListener('hotspot-refresh', handler);
  }, [fetchHotspots]);

  useEffect(() => {
    if (notifications.length > 0) {
      const latest = notifications[0];
      setToast({ title: latest.title, score: latest.score });
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 5000);
      fetchHotspots();
    }
  }, [notifications, fetchHotspots]);

  function handleCardFilter(f: CardFilter) {
    setCardFilter(f);
    setSearch('');
    if (f !== 'keyword') setSelectedKeyword(null);
    else if (keywords.length > 0) setSelectedKeyword(keywords[0].id);
  }

  const keywordMap = Object.fromEntries(keywords.map(k => [k.id, k.keyword]));

  // 当前激活的过滤条件数量（用于提示）
  const activeFilters = [
    cardFilter !== 'all',
    sourceFilter !== 'all',
    search.trim().length > 0,
  ].filter(Boolean).length;

  return (
    <>
      <ParticleBg />
      <NavBar />

      {/* Toast */}
      {toast && (
        <div className="fixed top-16 right-4 z-50 max-w-xs animate-float pointer-events-none">
          <div className={`border rounded-lg p-3 shadow-lg bg-bg-card
            ${toast.score >= 80 ? 'border-neon-yellow/50' : 'border-neon-cyan/40'}`}>
            <div className="flex items-start gap-2">
              <span className={toast.score >= 80 ? 'text-neon-yellow' : 'text-neon-cyan'}>
                {toast.score >= 80 ? '⚡' : '◈'}
              </span>
              <div>
                <div className={`text-[10px] font-bold mb-0.5 ${toast.score >= 80 ? 'text-neon-yellow' : 'text-neon-cyan'}`}>
                  新热点 · {toast.score >= 80 ? '高' : toast.score >= 50 ? '中' : '低'}等级 [{toast.score}分]
                </div>
                <div className="text-xs text-text-primary line-clamp-2">{toast.title}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        {/* 标题 */}
        <div className="mb-5">
          <NeonText as="h1" color="cyan" className="text-2xl font-black tracking-widest">
            HOT MONITOR
          </NeonText>
          <p className="text-text-dim text-xs mt-0.5 font-mono">AI-POWERED TREND RADAR // REAL-TIME</p>
        </div>

        {/* 统计卡片 — 维度一：时间/等级/监控词 */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: '总热点',   value: stats.total,    color: 'text-neon-cyan',    f: 'all' as CardFilter,     desc: '全部数据' },
            { label: '今日热点', value: stats.today,    color: 'text-neon-green',   f: 'today' as CardFilter,   desc: '今天新增' },
            { label: '紧急热点', value: stats.urgent,   color: 'text-neon-yellow',  f: 'urgent' as CardFilter,  desc: '高等级' },
            { label: '监控词',   value: stats.keywords, color: 'text-neon-magenta', f: 'keyword' as CardFilter, desc: '活跃中' },
          ].map((s) => (
            <button key={s.f} onClick={() => handleCardFilter(s.f)}
              className={`relative bg-bg-card border rounded-lg p-3 text-center transition-all duration-200 cursor-pointer
                ${cardFilter === s.f ? 'border-white/25 shadow-[0_0_15px_rgba(0,245,255,0.08)]' : 'border-white/5 hover:border-white/12'}`}
            >
              <div className={`text-2xl font-display font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-text-muted uppercase mt-0.5 tracking-wider">{s.label}</div>
              <div className="text-[9px] text-text-dim mt-0.5">{s.desc}</div>
              {cardFilter === s.f && (
                <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-0.5 rounded-full ${s.color.replace('text-', 'bg-')}`} />
              )}
            </button>
          ))}
        </div>

        {/* 来源标签 + 搜索框 — 维度二：来源 & 关键词 */}
        <div className="flex items-center justify-between gap-3 mb-4 border-b border-white/5 pb-3 flex-wrap">
          {/* 来源标签 */}
          <div className="flex items-center gap-1 flex-wrap">
            {SOURCE_FILTERS.map((s) => (
              <button key={s.value} onClick={() => setSourceFilter(s.value)}
                className={`px-2.5 py-1 text-xs font-mono rounded transition-all cursor-pointer flex items-center gap-1
                  ${sourceFilter === s.value
                    ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30'
                    : 'text-text-muted hover:text-text-primary hover:bg-white/5 border border-transparent'
                  }`}
              >
                <span>{s.icon}</span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            ))}
          </div>

          {/* 搜索框 */}
          <div className="flex items-center gap-2">
            {activeFilters > 0 && (
              <button
                onClick={() => { setCardFilter('all'); setSourceFilter('all'); setSearch(''); setSelectedKeyword(null); }}
                className="text-[10px] font-mono text-neon-red/70 hover:text-neon-red border border-neon-red/20 hover:border-neon-red/40 px-2 py-1 rounded transition-all cursor-pointer"
              >
                清除筛选 ({activeFilters})
              </button>
            )}
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim text-xs">🔍</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索热点..."
                className="pl-7 pr-7 py-1.5 text-xs font-mono bg-bg-secondary border border-white/10 rounded
                  text-text-primary placeholder:text-text-dim
                  focus:outline-none focus:border-neon-cyan/40 focus:shadow-[0_0_8px_rgba(0,245,255,0.15)]
                  transition-all w-40"
              />
              {search && (
                <button onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-primary text-xs cursor-pointer">
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 监控词子筛选（仅 keyword 卡片激活时显示） */}
        {cardFilter === 'keyword' && keywords.length > 0 && (
          <div className="flex gap-1.5 mb-4 flex-wrap">
            {keywords.map((kw) => (
              <button key={kw.id} onClick={() => setSelectedKeyword(kw.id)}
                className={`px-2.5 py-1 text-xs font-mono rounded transition-all cursor-pointer
                  ${selectedKeyword === kw.id
                    ? 'bg-neon-magenta/10 text-neon-magenta border border-neon-magenta/30'
                    : 'text-text-muted border border-white/10 hover:border-white/20'
                  }`}
              >
                #{kw.keyword}
              </button>
            ))}
          </div>
        )}

        {/* 热点列表 */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-bg-secondary rounded-lg animate-pulse border border-white/5" />
            ))}
          </div>
        ) : hotspots.length === 0 ? (
          <CyberCard className="text-center py-16">
            <div className="text-4xl mb-3 opacity-20">◈</div>
            <NeonText color="cyan" className="text-base">
              {search ? `未找到"${search}"相关热点` :
               cardFilter === 'urgent' ? '暂无紧急热点' :
               cardFilter === 'today' ? '今日暂无热点' : '暂无热点数据'}
            </NeonText>
            <p className="text-text-muted text-xs mt-2 font-mono">
              {cardFilter === 'keyword' && keywords.length === 0
                ? '前往「监控词」页面添加关键词'
                : '点击导航栏「立即采集」开始监控'}
            </p>
          </CyberCard>
        ) : (
          <div className="space-y-3">
            {hotspots.map((h) => (
              <HotspotCard
                key={h.id}
                title={h.title}
                summary={h.summary}
                sourceType={h.source_type}
                sourceUrl={h.source_url}
                sourceAuthor={h.source_author}
                aiScore={h.ai_score}
                aiVerified={h.ai_verified}
                discoveredAt={h.discovered_at}
                keyword={h.keyword_id ? keywordMap[h.keyword_id] : undefined}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
