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
type SortField = 'score' | 'discovered_at' | 'published_at' | 'source_type' | 'keyword_id';
type TimeRange = 'all' | '1h' | '6h' | '24h' | '3d' | '7d' | 'custom';
type GroupMode = 'none' | 'source' | 'keyword' | 'score' | 'time';

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

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'score',         label: 'AI 评分' },
  { value: 'discovered_at', label: '发现时间' },
  { value: 'published_at',  label: '发布时间' },
  { value: 'source_type',   label: '来源类型' },
  { value: 'keyword_id',    label: '关键词' },
];

const TIME_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: 'all',  label: '全部' },
  { value: '1h',   label: '1小时' },
  { value: '6h',   label: '6小时' },
  { value: '24h',  label: '24小时' },
  { value: '3d',   label: '3天' },
  { value: '7d',   label: '7天' },
  { value: 'custom', label: '自定义' },
];

const SCORE_PRESETS = [
  { min: 0,   max: 100, label: '全部' },
  { min: 80,  max: 100, label: '紧急' },
  { min: 60,  max: 79,  label: '中等' },
  { min: 0,   max: 59,  label: '普通' },
];

const GROUP_OPTIONS: { value: GroupMode; label: string }[] = [
  { value: 'none',    label: '平铺' },
  { value: 'source',  label: '按来源' },
  { value: 'keyword', label: '按关键词' },
  { value: 'score',   label: '按评分' },
  { value: 'time',    label: '按时间' },
];

const PAGE_SIZES = [10, 20, 50, 100];

export default function HomePage() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardFilter, setCardFilter] = useState<CardFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceType | 'all'>('all');
  const [selectedKeywordIds, setSelectedKeywordIds] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({ total: 0, today: 0, urgent: 0, keywords: 0, filtered: 0 });
  const [toast, setToast] = useState<{ title: string; score: number } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { notifications } = useSocket();

  // === 新增功能状态 ===
  // 1. 排序
  const [sortBy, setSortBy] = useState<SortField>('score');
  const [sortAsc, setSortAsc] = useState(false);

  // 2. 时间范围
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [customSince, setCustomSince] = useState('');
  const [customUntil, setCustomUntil] = useState('');

  // 3. 评分区间
  const [scoreMin, setScoreMin] = useState(0);
  const [scoreMax, setScoreMax] = useState(100);

  // 4. 关键词多选 — 使用 selectedKeywordIds

  // 5. 分组
  const [groupMode, setGroupMode] = useState<GroupMode>('none');

  // 6. 分页
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(60);

  // 高级筛选面板是否展开
  const [showAdvanced, setShowAdvanced] = useState(false);

  const fetchHotspots = useCallback(async () => {
    try {
      const params = new URLSearchParams();

      // 卡片维度过滤
      if (cardFilter === 'today') {
        const d = new Date(); d.setHours(0, 0, 0, 0);
        params.set('since', d.toISOString());
      } else if (cardFilter === 'urgent') {
        params.set('min_score', '80');
      } else if (cardFilter === 'keyword' && selectedKeywordIds.length > 0) {
        params.set('keyword_id', selectedKeywordIds.join(','));
      }

      // 来源
      if (sourceFilter !== 'all') params.set('source_type', sourceFilter);

      // 全文搜索
      if (search.trim()) params.set('search', search.trim());

      // --- 高级筛选 ---

      // 排序
      params.set('sort_by', sortBy);
      params.set('sort_order', sortAsc ? 'asc' : 'desc');

      // 时间
      if (timeRange !== 'all') {
        if (timeRange === 'custom') {
          if (customSince) params.set('since', customSince);
          if (customUntil) params.set('until', customUntil);
        } else {
          params.set('time_range', timeRange);
        }
      }

      // 评分区间（如果非默认）
      const scorePresetActive = SCORE_PRESETS.some(p => p.min === scoreMin && p.max === scoreMax);
      if (!scorePresetActive || !(scoreMin === 0 && scoreMax === 100)) {
        if (scoreMin > 0) params.set('min_score', String(scoreMin));
        if (scoreMax < 100) params.set('max_score', String(scoreMax));
      }

      // 分页
      params.set('limit', String(pageSize));
      params.set('offset', String((page - 1) * pageSize));

      const res = await fetch(`/api/hotspots?${params}`);
      if (res.ok) {
        const data = await res.json();
        setHotspots(data.hotspots || []);
        setStats(data.stats || { total: 0, today: 0, urgent: 0, keywords: 0, filtered: 0 });
      }
    } catch (e) {
      console.error('Failed to fetch hotspots:', e);
    } finally {
      setLoading(false);
    }
  }, [cardFilter, sourceFilter, selectedKeywordIds, search, sortBy, sortAsc, timeRange, customSince, customUntil, scoreMin, scoreMax, page, pageSize]);

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
    setPage(1);
    if (f !== 'keyword') setSelectedKeywordIds([]);
    else if (keywords.length > 0) setSelectedKeywordIds([keywords[0].id]);
  }

  function toggleKeyword(id: number) {
    setSelectedKeywordIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    setPage(1);
  }

  function handleScorePreset(min: number, max: number) {
    setScoreMin(min);
    setScoreMax(max);
    setPage(1);
  }

  function handleTimeRange(tr: TimeRange) {
    setTimeRange(tr);
    setPage(1);
  }

  const totalPages = Math.ceil((stats.filtered || hotspots.length) / pageSize);

  const keywordMap = Object.fromEntries(keywords.map(k => [k.id, k.keyword]));

  const activeFilters = [
    cardFilter !== 'all',
    sourceFilter !== 'all',
    search.trim().length > 0,
    sortBy !== 'score' || sortAsc,
    timeRange !== 'all',
    !(scoreMin === 0 && scoreMax === 100),
    groupMode !== 'none',
  ].filter(Boolean).length;

  function resetAllFilters() {
    setCardFilter('all');
    setSourceFilter('all');
    setSearch('');
    setSelectedKeywordIds([]);
    setSortBy('score');
    setSortAsc(false);
    setTimeRange('all');
    setCustomSince('');
    setCustomUntil('');
    setScoreMin(0);
    setScoreMax(100);
    setGroupMode('none');
    setPage(1);
  }

  // --- 分组渲染 ---
  function getGroupedHotspots(): Record<string, Hotspot[]> {
    if (groupMode === 'none') return { '': hotspots };

    const groups: Record<string, Hotspot[]> = {};
    for (const h of hotspots) {
      let key = '';
      switch (groupMode) {
        case 'source':
          key = h.source_type;
          break;
        case 'keyword':
          key = h.keyword_id ? keywordMap[h.keyword_id] || `#${h.keyword_id}` : '未分类';
          break;
        case 'score':
          if (h.ai_score >= 80) key = '紧急 (80-100)';
          else if (h.ai_score >= 60) key = '中等 (60-79)';
          else key = '普通 (0-59)';
          break;
        case 'time':
          const d = new Date(h.discovered_at);
          const now = new Date();
          const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const yesterdayStart = new Date(dayStart.getTime() - 86400000);
          if (d >= dayStart) key = '今天';
          else if (d >= yesterdayStart) key = '昨天';
          else key = '更早';
          break;
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(h);
    }
    return groups;
  }

  const grouped = getGroupedHotspots();

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

        {/* 统计卡片 */}
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

        {/* 操作栏：来源标签 + 搜索 + 高级筛选切换 */}
        <div className="flex items-center justify-between gap-3 mb-3 border-b border-white/5 pb-3 flex-wrap">
          {/* 来源标签 */}
          <div className="flex items-center gap-1 flex-wrap">
            {SOURCE_FILTERS.map((s) => (
              <button key={s.value} onClick={() => { setSourceFilter(s.value); setPage(1); }}
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

          {/* 搜索 & 高级切换 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`px-2 py-1 text-[10px] font-mono rounded border transition-all cursor-pointer
                ${showAdvanced
                  ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30'
                  : 'text-text-muted border-white/10 hover:border-white/20'
                }`}
            >
              ⚙ 筛选 {showAdvanced ? '▲' : '▼'}
            </button>
            {activeFilters > 0 && (
              <button onClick={resetAllFilters}
                className="text-[10px] font-mono text-neon-red/70 hover:text-neon-red border border-neon-red/20 hover:border-neon-red/40 px-2 py-1 rounded transition-all cursor-pointer">
                重置 ({activeFilters})
              </button>
            )}
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim text-xs">🔍</span>
              <input type="text" value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="搜索热点..."
                className="pl-7 pr-7 py-1.5 text-xs font-mono bg-bg-secondary border border-white/10 rounded
                  text-text-primary placeholder:text-text-dim
                  focus:outline-none focus:border-neon-cyan/40 focus:shadow-[0_0_8px_rgba(0,245,255,0.15)]
                  transition-all w-40"
              />
              {search && (
                <button onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-primary text-xs cursor-pointer">✕</button>
              )}
            </div>
          </div>
        </div>

        {/* ===== 高级筛选面板 ===== */}
        {showAdvanced && (
          <CyberCard className="p-4 mb-4 space-y-4">
            {/* 第1行：排序 + 分组 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* 排序 */}
              <div>
                <div className="text-[10px] text-text-dim font-mono mb-1.5 tracking-wider uppercase">排序</div>
                <div className="flex gap-1">
                  <select value={sortBy} onChange={(e) => { setSortBy(e.target.value as SortField); setPage(1); }}
                    className="flex-1 px-2 py-1 text-xs font-mono bg-bg-secondary border border-white/10 rounded
                      text-text-primary focus:outline-none focus:border-neon-cyan/40 cursor-pointer">
                    {SORT_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <button onClick={() => { setSortAsc(!sortAsc); setPage(1); }}
                    className={`px-2 py-1 text-xs border rounded cursor-pointer transition-all
                      ${sortAsc ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30' : 'text-text-muted border-white/10 hover:border-white/20'}`}
                    title={sortAsc ? '升序 ↑' : '降序 ↓'}
                  >
                    {sortAsc ? '↑ 升序' : '↓ 降序'}
                  </button>
                </div>
              </div>

              {/* 分组 */}
              <div>
                <div className="text-[10px] text-text-dim font-mono mb-1.5 tracking-wider uppercase">分组查看</div>
                <div className="flex gap-1 flex-wrap">
                  {GROUP_OPTIONS.map(g => (
                    <button key={g.value} onClick={() => setGroupMode(g.value)}
                      className={`px-2 py-1 text-[10px] font-mono rounded border transition-all cursor-pointer
                        ${groupMode === g.value
                          ? 'bg-neon-magenta/10 text-neon-magenta border-neon-magenta/30'
                          : 'text-text-muted border-white/10 hover:border-white/20'
                        }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 每页条数 */}
              <div>
                <div className="text-[10px] text-text-dim font-mono mb-1.5 tracking-wider uppercase">每页条数</div>
                <div className="flex gap-1">
                  {PAGE_SIZES.map(s => (
                    <button key={s} onClick={() => { setPageSize(s); setPage(1); }}
                      className={`px-2 py-1 text-[10px] font-mono rounded border transition-all cursor-pointer
                        ${pageSize === s
                          ? 'bg-neon-green/10 text-neon-green border-neon-green/30'
                          : 'text-text-muted border-white/10 hover:border-white/20'
                        }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* 结果计数 */}
              <div className="flex items-end">
                <div className="text-xs text-text-dim font-mono">
                  匹配结果：<span className="text-neon-cyan">{stats.filtered}</span> / {stats.total}
                </div>
              </div>
            </div>

            {/* 第2行：时间范围 + 评分区间 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 时间范围 */}
              <div>
                <div className="text-[10px] text-text-dim font-mono mb-1.5 tracking-wider uppercase">时间范围</div>
                <div className="flex gap-1 flex-wrap mb-2">
                  {TIME_OPTIONS.map(t => (
                    <button key={t.value} onClick={() => handleTimeRange(t.value)}
                      className={`px-2 py-1 text-[10px] font-mono rounded border transition-all cursor-pointer
                        ${timeRange === t.value
                          ? 'bg-neon-yellow/10 text-neon-yellow border-neon-yellow/30'
                          : 'text-text-muted border-white/10 hover:border-white/20'
                        }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {timeRange === 'custom' && (
                  <div className="flex gap-2 items-center">
                    <input type="datetime-local" value={customSince}
                      onChange={(e) => { setCustomSince(e.target.value); setPage(1); }}
                      className="flex-1 px-2 py-1 text-[10px] font-mono bg-bg-secondary border border-white/10 rounded
                        text-text-primary focus:outline-none focus:border-neon-cyan/40"
                    />
                    <span className="text-text-dim text-[10px]">~</span>
                    <input type="datetime-local" value={customUntil}
                      onChange={(e) => { setCustomUntil(e.target.value); setPage(1); }}
                      className="flex-1 px-2 py-1 text-[10px] font-mono bg-bg-secondary border border-white/10 rounded
                        text-text-primary focus:outline-none focus:border-neon-cyan/40"
                    />
                  </div>
                )}
              </div>

              {/* 评分区间 */}
              <div>
                <div className="text-[10px] text-text-dim font-mono mb-1.5 tracking-wider uppercase">
                  AI 评分区间
                  <span className="ml-2 text-neon-cyan">{scoreMin} - {scoreMax}</span>
                </div>
                <div className="flex gap-1 flex-wrap mb-2">
                  {SCORE_PRESETS.map(p => (
                    <button key={p.label} onClick={() => handleScorePreset(p.min, p.max)}
                      className={`px-2 py-1 text-[10px] font-mono rounded border transition-all cursor-pointer
                        ${scoreMin === p.min && scoreMax === p.max
                          ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30'
                          : 'text-text-muted border-white/10 hover:border-white/20'
                        }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 items-center">
                  <input type="range" min={0} max={100} value={scoreMin}
                    onChange={(e) => { const v = Math.min(Number(e.target.value), scoreMax); setScoreMin(v); setPage(1); }}
                    className="flex-1 h-1.5 accent-neon-cyan cursor-pointer"
                  />
                  <span className="text-text-dim text-[10px] font-mono w-8 text-right">{scoreMin}</span>
                  <span className="text-text-dim text-[10px]">-</span>
                  <span className="text-text-dim text-[10px] font-mono w-8">{scoreMax}</span>
                  <input type="range" min={0} max={100} value={scoreMax}
                    onChange={(e) => { const v = Math.max(Number(e.target.value), scoreMin); setScoreMax(v); setPage(1); }}
                    className="flex-1 h-1.5 accent-neon-cyan cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </CyberCard>
        )}

        {/* 监控词子筛选（多选模式） */}
        {keywords.length > 0 && (
          <div className="flex gap-1.5 mb-4 flex-wrap items-center">
            <span className="text-[10px] text-text-dim font-mono mr-1 uppercase">关键词:</span>
            {keywords.map((kw) => (
              <button key={kw.id} onClick={() => toggleKeyword(kw.id)}
                className={`px-2.5 py-1 text-xs font-mono rounded transition-all cursor-pointer
                  ${selectedKeywordIds.includes(kw.id)
                    ? 'bg-neon-magenta/15 text-neon-magenta border border-neon-magenta/40 shadow-[0_0_8px_rgba(255,0,255,0.08)]'
                    : 'text-text-muted border border-white/10 hover:border-white/20'
                  }`}
              >
                #{kw.keyword}
              </button>
            ))}
            {selectedKeywordIds.length > 0 && (
              <button onClick={() => setSelectedKeywordIds([])}
                className="px-2 py-1 text-[10px] font-mono text-neon-red/70 hover:text-neon-red border border-neon-red/20 hover:border-neon-red/40 rounded transition-all cursor-pointer">
                清除
              </button>
            )}
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
        ) : groupMode === 'none' ? (
          /* 平铺模式 */
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
        ) : (
          /* 分组模式 */
          <div className="space-y-5">
            {Object.entries(grouped).map(([groupKey, items]) => (
              <div key={groupKey}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono font-bold text-neon-cyan tracking-wider uppercase">
                    {groupKey}
                  </span>
                  <span className="text-[10px] text-text-dim font-mono">({items.length})</span>
                  <div className="flex-1 h-px bg-white/5" />
                </div>
                <div className="space-y-2">
                  {items.map((h) => (
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
              </div>
            ))}
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5">
            <div className="text-[10px] text-text-dim font-mono">
              共 {stats.filtered} 条 · 第 {page}/{totalPages} 页
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(1)} disabled={page <= 1}
                className="px-2 py-1 text-[10px] font-mono border border-white/10 rounded
                  text-text-muted hover:text-text-primary hover:border-white/20
                  disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all">
                首页
              </button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-2 py-1 text-[10px] font-mono border border-white/10 rounded
                  text-text-muted hover:text-text-primary hover:border-white/20
                  disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all">
                上一页
              </button>
              {/* 页码按钮 */}
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (page <= 4) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = page - 3 + i;
                }
                return (
                  <button key={pageNum} onClick={() => setPage(pageNum)}
                    className={`w-7 h-7 text-[10px] font-mono rounded border transition-all cursor-pointer
                      ${pageNum === page
                        ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30'
                        : 'text-text-muted border-white/10 hover:border-white/20'
                      }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="px-2 py-1 text-[10px] font-mono border border-white/10 rounded
                  text-text-muted hover:text-text-primary hover:border-white/20
                  disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all">
                下一页
              </button>
              <button onClick={() => setPage(totalPages)} disabled={page >= totalPages}
                className="px-2 py-1 text-[10px] font-mono border border-white/10 rounded
                  text-text-muted hover:text-text-primary hover:border-white/20
                  disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all">
                末页
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}