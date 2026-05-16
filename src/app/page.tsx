'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { NavBar } from '@/components/nav-bar';
import { ParticleBg } from '@/components/ui/particle-bg';
import { HotspotCard } from '@/components/hotspot-card';
import { CyberCard } from '@/components/ui/cyber-card';
import { NeonText } from '@/components/ui/neon-text';
import { useSocket } from '@/lib/hooks/use-socket';
import { Hotspot, Keyword, SourceType } from '@/types';

type SortField = 'score' | 'discovered_at' | 'published_at' | 'source_type' | 'keyword_id';
type TimeRange = 'all' | '1h' | '6h' | '24h' | '3d' | '7d' | 'custom';
type GroupMode = 'none' | 'source' | 'keyword' | 'score' | 'time';
type TimeField = 'discovered_at' | 'published_at';

type FilterDropdown = 'source' | 'time' | 'score' | 'keyword' | 'sort' | null;

const SOURCES: { value: SourceType; label: string; icon: string }[] = [
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
];

const SCORE_PRESETS = [
  { min: 0,   max: 100, label: '全部' },
  { min: 80,  max: 100, label: '紧急 (80-100)' },
  { min: 60,  max: 79,  label: '中等 (60-79)' },
  { min: 0,   max: 59,  label: '普通 (0-59)' },
];

const GROUP_OPTIONS: { value: GroupMode; label: string }[] = [
  { value: 'none',    label: '平铺' },
  { value: 'source',  label: '来源' },
  { value: 'keyword', label: '关键词' },
  { value: 'score',   label: '评分' },
  { value: 'time',    label: '时间' },
];

const PAGE_SIZES = [10, 20, 50, 100];

export default function HomePage() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({ total: 0, today: 0, urgent: 0, keywords: 0, filtered: 0 });
  const [toast, setToast] = useState<{ title: string; score: number } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { notifications } = useSocket();

  // --- 统一筛选状态 ---
  const [sourceFilter, setSourceFilter] = useState<SourceType | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortField>('score');
  const [sortAsc, setSortAsc] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [timeField, setTimeField] = useState<TimeField>('discovered_at');
  const [customSince, setCustomSince] = useState('');
  const [customUntil, setCustomUntil] = useState('');
  const [scoreMin, setScoreMin] = useState(0);
  const [scoreMax, setScoreMax] = useState(100);
  const [selectedKeywordIds, setSelectedKeywordIds] = useState<number[]>([]);
  const [groupMode, setGroupMode] = useState<GroupMode>('none');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(60);

  // --- UI 状态 ---
  const [openDropdown, setOpenDropdown] = useState<FilterDropdown>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchHotspots = useCallback(async () => {
    try {
      const params = new URLSearchParams();

      if (sourceFilter !== 'all') params.set('source_type', sourceFilter);
      if (search.trim()) params.set('search', search.trim());

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
      params.set('time_field', timeField);

      // 评分
      if (scoreMin > 0) params.set('min_score', String(scoreMin));
      if (scoreMax < 100) params.set('max_score', String(scoreMax));

      // 关键词
      if (selectedKeywordIds.length > 0) {
        params.set('keyword_id', selectedKeywordIds.join(','));
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
  }, [sourceFilter, search, sortBy, sortAsc, timeRange, timeField, customSince, customUntil, scoreMin, scoreMax, selectedKeywordIds, page, pageSize]);

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

  // --- 筛选辅助 ---

  /** 获取某个筛选维度的展示文本 */
  function getSourceLabel(): string {
    if (sourceFilter === 'all') return '全部来源';
    const s = SOURCES.find(s => s.value === sourceFilter);
    return s ? s.label : sourceFilter;
  }

  function getTimeLabel(): string {
    if (timeRange === 'all') return '全部时间';
    const t = TIME_OPTIONS.find(t => t.value === timeRange);
    if (t) return t.label;
    if (timeRange === 'custom') return '自定义';
    return timeRange;
  }

  function getScoreLabel(): string {
    const preset = SCORE_PRESETS.find(p => p.min === scoreMin && p.max === scoreMax);
    if (preset) return preset.label;
    return `${scoreMin}-${scoreMax}`;
  }

  function getKeywordLabel(): string {
    if (selectedKeywordIds.length === 0) return '全部关键词';
    if (selectedKeywordIds.length === 1) {
      const kw = keywords.find(k => k.id === selectedKeywordIds[0]);
      return kw ? `#${kw.keyword}` : '1个关键词';
    }
    return `已选${selectedKeywordIds.length}个`;
  }

  function getSortLabel(): string {
    const s = SORT_OPTIONS.find(s => s.value === sortBy);
    return s ? `${s.label} ${sortAsc ? '↑' : '↓'}` : 'AI 评分 ↓';
  }

  /** 切换 dropdown */
  function toggleDropdown(d: FilterDropdown) {
    setOpenDropdown(prev => prev === d ? null : d);
  }

  /** 通用设置函数：设置值 + 重置页码 + 关闭下拉 */
  function setAndRefresh<T>(setter: (val: T) => void, value: T) {
    setter(value);
    setPage(1);
  }

  function applyFilter() {
    setOpenDropdown(null);
    setPage(1);
    setLoading(true);
    // fetchHotspots will be called by the useEffect dependency
  }

  // --- 重置 ---
  function resetAll() {
    setSourceFilter('all');
    setSortBy('score');
    setSortAsc(false);
    setTimeRange('all');
    setTimeField('discovered_at');
    setCustomSince('');
    setCustomUntil('');
    setScoreMin(0);
    setScoreMax(100);
    setSelectedKeywordIds([]);
    setGroupMode('none');
    setSearch('');
    setPage(1);
    setPageSize(60);
  }

  // --- 分页 ---
  const totalPages = Math.ceil((stats.filtered || hotspots.length) / pageSize);

  // --- 关键词 map ---
  const keywordMap = Object.fromEntries(keywords.map(k => [k.id, k.keyword]));

  // --- 筛选条件标签 ---
  const filterTags: { key: string; label: string; onRemove: () => void }[] = [];

  if (sourceFilter !== 'all') {
    filterTags.push({ key: 'source', label: `来源:${getSourceLabel()}`, onRemove: () => { setSourceFilter('all'); setPage(1); } });
  }
  if (timeRange !== 'all') {
    filterTags.push({ key: 'time', label: `时间:${getTimeLabel()}`, onRemove: () => { setTimeRange('all'); setPage(1); } });
  }
  if (!(scoreMin === 0 && scoreMax === 100)) {
    filterTags.push({ key: 'score', label: `评分:${scoreMin}-${scoreMax}`, onRemove: () => { setScoreMin(0); setScoreMax(100); setPage(1); } });
  }
  if (selectedKeywordIds.length > 0) {
    filterTags.push({ key: 'keyword', label: `关键词:${selectedKeywordIds.length}个`, onRemove: () => { setSelectedKeywordIds([]); setPage(1); } });
  }
  if (search.trim()) {
    filterTags.push({ key: 'search', label: `搜索:"${search}"`, onRemove: () => { setSearch(''); setPage(1); } });
  }
  if (sortBy !== 'score' || sortAsc) {
    filterTags.push({ key: 'sort', label: `排序:${getSortLabel()}`, onRemove: () => { setSortBy('score'); setSortAsc(false); setPage(1); } });
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
        case 'time': {
          const d = new Date(h.discovered_at);
          const now = new Date();
          const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const yesterdayStart = new Date(dayStart.getTime() - 86400000);
          if (d >= dayStart) key = '今天';
          else if (d >= yesterdayStart) key = '昨天';
          else key = '更早';
          break;
        }
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
          <div className={`border rounded-lg p-3 shadow-lg bg-bg-card ${toast.score >= 80 ? 'border-neon-yellow/50' : 'border-neon-cyan/40'}`}>
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

        {/* 统计卡片（仅展示，不可点击） */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: '总热点',   value: stats.total,    color: 'text-neon-cyan' },
            { label: '今日热点', value: stats.today,    color: 'text-neon-green' },
            { label: '紧急热点', value: stats.urgent,   color: 'text-neon-yellow' },
            { label: '监控词',   value: stats.keywords, color: 'text-neon-magenta' },
          ].map((s) => (
            <div key={s.label}
              className="bg-bg-card border border-white/5 rounded-lg p-3 text-center"
            >
              <div className={`text-2xl font-display font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-text-muted uppercase mt-0.5 tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>

        {/* === 统一筛选栏 === */}
        <div ref={dropdownRef} className="relative mb-3">
          <div className="flex items-center gap-1.5 flex-wrap border-b border-white/5 pb-3">
            {/* 搜索框 */}
            <div className="relative flex-1 min-w-[120px] max-w-[220px]">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-text-dim text-xs">🔍</span>
              <input type="text" value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="搜索标题/摘要..."
                className="w-full pl-7 pr-6 py-1.5 text-xs font-mono bg-bg-secondary border border-white/10 rounded
                  text-text-primary placeholder:text-text-dim
                  focus:outline-none focus:border-neon-cyan/40 transition-all"
              />
              {search && (
                <button onClick={() => { setSearch(''); setPage(1); }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-primary text-xs cursor-pointer">✕</button>
              )}
            </div>

            {/* --- 来源下拉 --- */}
            <div className="relative">
              <button onClick={() => toggleDropdown('source')}
                className={`px-2.5 py-1.5 text-[11px] font-mono border rounded cursor-pointer transition-all whitespace-nowrap
                  ${sourceFilter !== 'all'
                    ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30'
                    : 'text-text-muted border-white/10 hover:border-white/30 hover:text-text-primary'}`}
              >
                来源: {getSourceLabel()} ▾
              </button>
              {openDropdown === 'source' && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-bg-card border border-white/10 rounded-lg shadow-xl p-1.5 min-w-[130px]">
                  <button onClick={() => { setSourceFilter('all'); applyFilter(); }}
                    className={`w-full text-left px-3 py-1.5 text-xs font-mono rounded cursor-pointer transition-all
                      ${sourceFilter === 'all' ? 'bg-neon-cyan/10 text-neon-cyan' : 'text-text-muted hover:text-text-primary hover:bg-white/5'}`}
                  >全部来源</button>
                  {SOURCES.map(s => (
                    <button key={s.value} onClick={() => { setSourceFilter(s.value); applyFilter(); }}
                      className={`w-full text-left px-3 py-1.5 text-xs font-mono rounded cursor-pointer transition-all flex items-center gap-1.5
                        ${sourceFilter === s.value ? 'bg-neon-cyan/10 text-neon-cyan' : 'text-text-muted hover:text-text-primary hover:bg-white/5'}`}
                    >
                      <span>{s.icon}</span> {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* --- 时间下拉 --- */}
            <div className="relative">
              <button onClick={() => toggleDropdown('time')}
                className={`px-2.5 py-1.5 text-[11px] font-mono border rounded cursor-pointer transition-all whitespace-nowrap
                  ${timeRange !== 'all'
                    ? 'bg-neon-yellow/10 text-neon-yellow border-neon-yellow/30'
                    : 'text-text-muted border-white/10 hover:border-white/30 hover:text-text-primary'}`}
              >
                时间: {getTimeLabel()} ▾
              </button>
              {openDropdown === 'time' && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-bg-card border border-white/10 rounded-lg shadow-xl p-3 min-w-[260px]">
                  <div className="flex gap-1 flex-wrap mb-2">
                    {TIME_OPTIONS.map(t => (
                      <button key={t.value} onClick={() => { setTimeRange(t.value); setPage(1); }}
                        className={`px-2 py-1 text-[10px] font-mono rounded border cursor-pointer transition-all
                          ${timeRange === t.value
                            ? 'bg-neon-yellow/10 text-neon-yellow border-neon-yellow/30'
                            : 'text-text-muted border-white/10 hover:border-white/20'}`}
                      >{t.label}</button>
                    ))}
                    <button onClick={() => { setTimeRange('custom'); setPage(1); }}
                      className={`px-2 py-1 text-[10px] font-mono rounded border cursor-pointer transition-all
                        ${timeRange === 'custom'
                          ? 'bg-neon-yellow/10 text-neon-yellow border-neon-yellow/30'
                          : 'text-text-muted border-white/10 hover:border-white/20'}`}
                    >自定义</button>
                  </div>
                  {/* 时间字段切换 */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] text-text-dim font-mono">依据:</span>
                    <button onClick={() => { setTimeField('discovered_at'); setPage(1); }}
                      className={`px-2 py-0.5 text-[10px] font-mono rounded border cursor-pointer transition-all
                        ${timeField === 'discovered_at'
                          ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30'
                          : 'text-text-muted border-white/10 hover:border-white/20'}`}
                    >发现时间</button>
                    <button onClick={() => { setTimeField('published_at'); setPage(1); }}
                      className={`px-2 py-0.5 text-[10px] font-mono rounded border cursor-pointer transition-all
                        ${timeField === 'published_at'
                          ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30'
                          : 'text-text-muted border-white/10 hover:border-white/20'}`}
                    >发布时间</button>
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
              )}
            </div>

            {/* --- 评分下拉 --- */}
            <div className="relative">
              <button onClick={() => toggleDropdown('score')}
                className={`px-2.5 py-1.5 text-[11px] font-mono border rounded cursor-pointer transition-all whitespace-nowrap
                  ${!(scoreMin === 0 && scoreMax === 100)
                    ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30'
                    : 'text-text-muted border-white/10 hover:border-white/30 hover:text-text-primary'}`}
              >
                评分: {getScoreLabel()} ▾
              </button>
              {openDropdown === 'score' && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-bg-card border border-white/10 rounded-lg shadow-xl p-3 min-w-[230px]">
                  <div className="flex gap-1 flex-wrap mb-3">
                    {SCORE_PRESETS.map(p => (
                      <button key={p.label} onClick={() => { setScoreMin(p.min); setScoreMax(p.max); setPage(1); }}
                        className={`px-2 py-1 text-[10px] font-mono rounded border cursor-pointer transition-all
                          ${scoreMin === p.min && scoreMax === p.max
                            ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30'
                            : 'text-text-muted border-white/10 hover:border-white/20'}`}
                      >{p.label}</button>
                    ))}
                  </div>
                  <div className="flex gap-2 items-center">
                    <input type="range" min={0} max={100} value={scoreMin}
                      onChange={(e) => { const v = Math.min(Number(e.target.value), scoreMax); setScoreMin(v); setPage(1); }}
                      className="flex-1 h-1.5 accent-neon-cyan cursor-pointer"
                    />
                    <span className="text-text-dim text-[10px] font-mono w-8 text-right">{scoreMin}</span>
                  </div>
                  <div className="flex gap-2 items-center mt-1">
                    <input type="range" min={0} max={100} value={scoreMax}
                      onChange={(e) => { const v = Math.max(Number(e.target.value), scoreMin); setScoreMax(v); setPage(1); }}
                      className="flex-1 h-1.5 accent-neon-cyan cursor-pointer"
                    />
                    <span className="text-text-dim text-[10px] font-mono w-8 text-right">{scoreMax}</span>
                  </div>
                </div>
              )}
            </div>

            {/* --- 关键词下拉 --- */}
            <div className="relative">
              <button onClick={() => toggleDropdown('keyword')}
                className={`px-2.5 py-1.5 text-[11px] font-mono border rounded cursor-pointer transition-all whitespace-nowrap
                  ${selectedKeywordIds.length > 0
                    ? 'bg-neon-magenta/10 text-neon-magenta border-neon-magenta/30'
                    : 'text-text-muted border-white/10 hover:border-white/30 hover:text-text-primary'}`}
              >
                关键词: {getKeywordLabel()} ▾
              </button>
              {openDropdown === 'keyword' && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-bg-card border border-white/10 rounded-lg shadow-xl p-2 min-w-[180px] max-h-[250px] overflow-y-auto">
                  {keywords.length === 0 && (
                    <div className="text-text-dim text-[10px] font-mono p-2 text-center">暂无关键词</div>
                  )}
                  {keywords.map(kw => (
                    <label key={kw.id}
                      className="flex items-center gap-2 px-2 py-1.5 text-xs font-mono rounded cursor-pointer
                        hover:bg-white/5 transition-all text-text-muted hover:text-text-primary"
                    >
                      <input type="checkbox" checked={selectedKeywordIds.includes(kw.id)}
                        onChange={() => {
                          setSelectedKeywordIds(prev =>
                            prev.includes(kw.id) ? prev.filter(x => x !== kw.id) : [...prev, kw.id]
                          );
                          setPage(1);
                        }}
                        className="accent-neon-magenta cursor-pointer"
                      />
                      #{kw.keyword}
                    </label>
                  ))}
                  {selectedKeywordIds.length > 0 && (
                    <button onClick={() => { setSelectedKeywordIds([]); setPage(1); }}
                      className="w-full text-left px-2 py-1 mt-1 text-[10px] font-mono text-neon-red/70 hover:text-neon-red rounded cursor-pointer transition-all"
                    >清除全部</button>
                  )}
                </div>
              )}
            </div>

            {/* --- 排序下拉 --- */}
            <div className="relative">
              <button onClick={() => toggleDropdown('sort')}
                className={`px-2.5 py-1.5 text-[11px] font-mono border rounded cursor-pointer transition-all whitespace-nowrap
                  text-text-muted border-white/10 hover:border-white/30 hover:text-text-primary`}
              >
                {getSortLabel()} ▾
              </button>
              {openDropdown === 'sort' && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-bg-card border border-white/10 rounded-lg shadow-xl p-1.5 min-w-[130px]">
                  {SORT_OPTIONS.map(s => (
                    <button key={s.value} onClick={() => { setSortBy(s.value); applyFilter(); }}
                      className={`w-full text-left px-3 py-1.5 text-xs font-mono rounded cursor-pointer transition-all
                        ${sortBy === s.value ? 'bg-neon-cyan/10 text-neon-cyan' : 'text-text-muted hover:text-text-primary hover:bg-white/5'}`}
                    >{s.label}</button>
                  ))}
                  <div className="border-t border-white/5 mt-1 pt-1">
                    <button onClick={() => { setSortAsc(!sortAsc); setPage(1); }}
                      className={`w-full text-left px-3 py-1.5 text-xs font-mono rounded cursor-pointer transition-all
                        ${sortAsc ? 'bg-neon-cyan/10 text-neon-cyan' : 'text-text-muted hover:text-text-primary hover:bg-white/5'}`}
                    >
                      {sortAsc ? '↑ 升序' : '↓ 降序'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 分组按钮组 */}
            <div className="flex items-center gap-0.5 border-l border-white/10 pl-2 ml-1">
              <span className="text-[10px] text-text-dim font-mono mr-1 hidden sm:inline">分组</span>
              {GROUP_OPTIONS.map(g => (
                <button key={g.value} onClick={() => setGroupMode(g.value)}
                  className={`px-1.5 py-1.5 text-[10px] font-mono rounded border cursor-pointer transition-all
                    ${groupMode === g.value
                      ? 'bg-neon-magenta/10 text-neon-magenta border-neon-magenta/30'
                      : 'text-text-muted border-white/10 hover:border-white/20 hover:text-text-primary'}`}
                >{g.label}</button>
              ))}
            </div>

            {/* 重置 */}
            {(sourceFilter !== 'all' || timeRange !== 'all' || !(scoreMin === 0 && scoreMax === 100) || selectedKeywordIds.length > 0 || search.trim() || sortBy !== 'score' || sortAsc) && (
              <button onClick={resetAll}
                className="px-2 py-1.5 text-[10px] font-mono text-neon-red/70 hover:text-neon-red border border-neon-red/20 hover:border-neon-red/40 rounded cursor-pointer transition-all whitespace-nowrap"
              >清空 ✕</button>
            )}
          </div>

          {/* 筛选条件标签 */}
          {filterTags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mt-2 pb-2">
              <span className="text-[9px] text-text-dim font-mono uppercase tracking-wider">已选:</span>
              {filterTags.map(tag => (
                <span key={tag.key}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono
                    bg-white/5 border border-white/10 rounded text-text-muted"
                >
                  {tag.label}
                  <button onClick={tag.onRemove}
                    className="text-text-dim hover:text-neon-red cursor-pointer transition-all ml-0.5"
                  >✕</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 每页条数 + 匹配结果计数 */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] text-text-dim font-mono">
            匹配: <span className="text-neon-cyan">{stats.filtered}</span> / {stats.total}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-text-dim font-mono">每页</span>
            {PAGE_SIZES.map(s => (
              <button key={s} onClick={() => { setPageSize(s); setPage(1); }}
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded border cursor-pointer transition-all
                  ${pageSize === s
                    ? 'bg-neon-green/10 text-neon-green border-neon-green/30'
                    : 'text-text-muted border-white/10 hover:border-white/20'}`}
              >{s}</button>
            ))}
          </div>
        </div>

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
              {search ? `未找到"${search}"相关热点` : '暂无热点数据，请先添加监控词并采集'}
            </NeonText>
            <p className="text-text-muted text-xs mt-2 font-mono">
              调整筛选条件或点击导航栏「立即采集」开始监控
            </p>
          </CyberCard>
        ) : groupMode === 'none' ? (
          <div className="space-y-3">
            {hotspots.map(h => (
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
          <div className="space-y-5">
            {Object.entries(grouped).map(([groupKey, items]) => (
              <div key={groupKey}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono font-bold text-neon-cyan tracking-wider uppercase">{groupKey}</span>
                  <span className="text-[10px] text-text-dim font-mono">({items.length})</span>
                  <div className="flex-1 h-px bg-white/5" />
                </div>
                <div className="space-y-2">
                  {items.map(h => (
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
                  disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all">首页</button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-2 py-1 text-[10px] font-mono border border-white/10 rounded
                  text-text-muted hover:text-text-primary hover:border-white/20
                  disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all">上一页</button>
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                let pn: number;
                if (totalPages <= 7) { pn = i + 1; }
                else if (page <= 4) { pn = i + 1; }
                else if (page >= totalPages - 3) { pn = totalPages - 6 + i; }
                else { pn = page - 3 + i; }
                return (
                  <button key={pn} onClick={() => setPage(pn)}
                    className={`w-7 h-7 text-[10px] font-mono rounded border cursor-pointer transition-all
                      ${pn === page ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30' : 'text-text-muted border-white/10 hover:border-white/20'}`}
                  >{pn}</button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="px-2 py-1 text-[10px] font-mono border border-white/10 rounded
                  text-text-muted hover:text-text-primary hover:border-white/20
                  disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all">下一页</button>
              <button onClick={() => setPage(totalPages)} disabled={page >= totalPages}
                className="px-2 py-1 text-[10px] font-mono border border-white/10 rounded
                  text-text-muted hover:text-text-primary hover:border-white/20
                  disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all">末页</button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}