'use client';

import { useState, useEffect, useRef } from 'react';
import { NavBar } from '@/components/nav-bar';
import { ParticleBg } from '@/components/ui/particle-bg';
import { HotspotCard } from '@/components/hotspot-card';
import { CyberCard } from '@/components/ui/cyber-card';
import { NeonText } from '@/components/ui/neon-text';
import { useSocket } from '@/lib/hooks/use-socket';
import { Hotspot, Keyword, SourceType } from '@/types';

type SortField = 'score' | 'discovered_at' | 'published_at' | 'source_type' | 'keyword_id';
type TimeRange = 'all' | '1h' | '6h' | '24h' | '3d' | '7d' | 'custom';
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
  { value: 'all', label: '全部' },
  { value: '1h',  label: '1小时' },
  { value: '6h',  label: '6小时' },
  { value: '24h', label: '24小时' },
  { value: '3d',  label: '3天' },
  { value: '7d',  label: '7天' },
];

const SCORE_PRESETS = [
  { min: 0, max: 100, label: '全部' },
  { min: 80, max: 100, label: '紧急 (80-100)' },
  { min: 60, max: 79, label: '中等 (60-79)' },
  { min: 0, max: 59, label: '普通 (0-59)' },
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

  // --- 筛选状态（同时保存在 state 和 ref 中，ref 用于 fetch 读取最新值） ---
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(60);

  // ref 镜像：始终与最新 state 同步
  const filtersRef = useRef({ sourceFilter, sortBy, sortAsc, timeRange, timeField, customSince, customUntil, scoreMin, scoreMax, selectedKeywordIds, page, pageSize, search });
  useEffect(() => {
    filtersRef.current = { sourceFilter, sortBy, sortAsc, timeRange, timeField, customSince, customUntil, scoreMin, scoreMax, selectedKeywordIds, page, pageSize, search };
  });

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

  // fetch 序号，用于丢弃过期请求
  const fetchSeqRef = useRef(0);

  /** 核心请求函数：从 ref 读取最新筛选状态，不会受闭包问题影响 */
  async function doFetch() {
    const seq = ++fetchSeqRef.current;
    setLoading(true);

    const f = filtersRef.current;
    const params = new URLSearchParams();

    if (f.sourceFilter !== 'all') params.set('source_type', f.sourceFilter);
    if (f.search.trim()) params.set('search', f.search.trim());
    params.set('sort_by', f.sortBy);
    params.set('sort_order', f.sortAsc ? 'asc' : 'desc');

    if (f.timeRange !== 'all') {
      if (f.timeRange === 'custom') {
        if (f.customSince) params.set('since', f.customSince);
        if (f.customUntil) params.set('until', f.customUntil);
      } else {
        params.set('time_range', f.timeRange);
      }
    }
    params.set('time_field', f.timeField);

    if (f.scoreMin > 0) params.set('min_score', String(f.scoreMin));
    if (f.scoreMax < 100) params.set('max_score', String(f.scoreMax));
    if (f.selectedKeywordIds.length > 0) params.set('keyword_id', f.selectedKeywordIds.join(','));

    params.set('limit', String(f.pageSize));
    params.set('offset', String((f.page - 1) * f.pageSize));

    try {
      const res = await fetch(`/api/hotspots?${params}`);
      if (seq !== fetchSeqRef.current) return;
      if (!res.ok) {
        console.error('Failed to fetch:', res.status, res.statusText);
        return;
      }
      const text = await res.text();
      if (seq !== fetchSeqRef.current) return;
      if (!text) {
        console.error('Empty response body');
        return;
      }
      const data = JSON.parse(text);
      if (seq !== fetchSeqRef.current) return;
      setHotspots(data.hotspots || []);
      setStats(data.stats || { total: 0, today: 0, urgent: 0, keywords: 0, filtered: 0 });
    } catch (e) {
      console.error('Failed to fetch:', e);
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  }

  // 首次加载
  useEffect(() => { doFetch(); fetch('/api/keywords').then(r => r.json()).then(d => setKeywords(d.keywords || [])); }, []);

  // socket 通知
  useEffect(() => {
    if (notifications.length > 0) {
      const latest = notifications[0];
      setToast({ title: latest.title, score: latest.score });
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 5000);
    }
  }, [notifications]);

  // hotspot-refresh 事件
  useEffect(() => {
    const handler = () => doFetch();
    window.addEventListener('hotspot-refresh', handler);
    return () => window.removeEventListener('hotspot-refresh', handler);
  }, []);

  /** 通用筛选变更：更新 state + 重新请求 */
  function apply(updater: () => void) {
    updater();
    // 等 React state 更新完成 → filtersRef 自动同步 → 再 fetch
    setTimeout(() => doFetch(), 0);
  }

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
    setSearch('');
    setPage(1);
    setPageSize(60);
    setOpenDropdown(null);
    setTimeout(() => doFetch(), 0);
  }

  // --- 分页 ---
  const totalPages = Math.ceil((stats.filtered || hotspots.length) / pageSize);

  // --- 关键词 map ---
  const keywordMap = Object.fromEntries(keywords.map(k => [k.id, k.keyword]));

  // --- 展示文本（从 state 读取即可，不需要 ref） ---
  function getSourceLabel() { return sourceFilter === 'all' ? '全部来源' : SOURCES.find(s => s.value === sourceFilter)?.label || sourceFilter; }
  function getTimeLabel() {
    if (timeRange === 'all') return '全部时间';
    const t = TIME_OPTIONS.find(t => t.value === timeRange);
    return t ? t.label : timeRange === 'custom' ? '自定义' : timeRange;
  }
  function getScoreLabel() {
    const p = SCORE_PRESETS.find(p => p.min === scoreMin && p.max === scoreMax);
    return p ? p.label : `${scoreMin}-${scoreMax}`;
  }
  function getKeywordLabel() {
    if (selectedKeywordIds.length === 0) return '全部关键词';
    if (selectedKeywordIds.length === 1) {
      const kw = keywords.find(k => k.id === selectedKeywordIds[0]);
      return kw ? `#${kw.keyword}` : '1个';
    }
    return `已选${selectedKeywordIds.length}个`;
  }
  function getSortLabel() {
    const s = SORT_OPTIONS.find(s => s.value === sortBy);
    return s ? `${s.label} ${sortAsc ? '↑' : '↓'}` : 'AI 评分 ↓';
  }

  // --- 筛选标签 ---
  const filterTags: { key: string; label: string; onRemove: () => void }[] = [];
  if (sourceFilter !== 'all') filterTags.push({ key: 'source', label: `来源:${getSourceLabel()}`, onRemove: () => apply(() => setSourceFilter('all')) });
  if (timeRange !== 'all') filterTags.push({ key: 'time', label: `时间:${getTimeLabel()}`, onRemove: () => apply(() => setTimeRange('all')) });
  if (!(scoreMin === 0 && scoreMax === 100)) filterTags.push({ key: 'score', label: `评分:${scoreMin}-${scoreMax}`, onRemove: () => apply(() => { setScoreMin(0); setScoreMax(100); }) });
  if (selectedKeywordIds.length > 0) filterTags.push({ key: 'keyword', label: `关键词:${selectedKeywordIds.length}个`, onRemove: () => apply(() => setSelectedKeywordIds([])) });
  if (search.trim()) filterTags.push({ key: 'search', label: `搜索:"${search}"`, onRemove: () => apply(() => setSearch('')) });
  if (!(sortBy === 'score' && !sortAsc)) filterTags.push({ key: 'sort', label: `排序:${getSortLabel()}`, onRemove: () => apply(() => { setSortBy('score'); setSortAsc(false); }) });

  return (
    <>
      <ParticleBg />
      <NavBar />
      {toast && (
        <div className="fixed top-16 right-4 z-50 max-w-xs animate-float pointer-events-none">
          <div className={`border rounded-lg p-3 shadow-lg bg-bg-card ${toast.score >= 80 ? 'border-neon-yellow/50' : 'border-neon-cyan/40'}`}>
            <div className="flex items-start gap-2">
              <span className={toast.score >= 80 ? 'text-neon-yellow' : 'text-neon-cyan'}>{toast.score >= 80 ? '⚡' : '◈'}</span>
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
        <div className="mb-5">
          <NeonText as="h1" color="cyan" className="text-2xl font-black tracking-widest">HOT MONITOR</NeonText>
          <p className="text-text-dim text-xs mt-0.5 font-mono">AI-POWERED TREND RADAR // REAL-TIME</p>
        </div>

        {/* 统计卡片（仅展示） */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: '总热点', value: stats.total, color: 'text-neon-cyan' },
            { label: '今日热点', value: stats.today, color: 'text-neon-green' },
            { label: '紧急热点', value: stats.urgent, color: 'text-neon-yellow' },
            { label: '监控词', value: stats.keywords, color: 'text-neon-magenta' },
          ].map(s => (
            <div key={s.label} className="bg-bg-card border border-white/5 rounded-lg p-3 text-center">
              <div className={`text-2xl font-display font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-text-muted uppercase mt-0.5 tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>

        {/* === 统一筛选栏 === */}
        <div ref={dropdownRef} className="relative mb-3">
          <div className="flex items-center gap-1.5 flex-wrap border-b border-white/5 pb-3">
            {/* 搜索框 */}
            <div className="relative flex-1 min-w-[120px] max-w-[200px]">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-text-dim text-xs">🔍</span>
              <input type="text" value={search}
                onChange={(e) => apply(() => { setSearch(e.target.value); setPage(1); })}
                placeholder="搜索标题/摘要..."
                className="w-full pl-7 pr-6 py-1.5 text-xs font-mono bg-bg-secondary border border-white/10 rounded
                  text-text-primary placeholder:text-text-dim focus:outline-none focus:border-neon-cyan/40 transition-all"
              />
              {search && <button onClick={() => apply(() => { setSearch(''); setPage(1); })} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-primary text-xs cursor-pointer">✕</button>}
            </div>

            {/* 来源 */}
            <div className="relative">
              <button onClick={() => setOpenDropdown(prev => prev === 'source' ? null : 'source')}
                className={`px-2.5 py-1.5 text-[11px] font-mono border rounded cursor-pointer transition-all whitespace-nowrap
                  ${sourceFilter !== 'all' ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30' : 'text-text-muted border-white/10 hover:border-white/30 hover:text-text-primary'}`}
              >来源: {getSourceLabel()} ▾</button>
              {openDropdown === 'source' && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-bg-card border border-white/10 rounded-lg shadow-xl p-1.5 min-w-[130px]">
                  {[{ value: 'all' as const, label: '全部来源', icon: '◈' }, ...SOURCES].map(s => (
                    <button key={s.value} onClick={() => apply(() => { setSourceFilter(s.value); setPage(1); setOpenDropdown(null); })}
                      className={`w-full text-left px-3 py-1.5 text-xs font-mono rounded cursor-pointer transition-all flex items-center gap-1.5
                        ${sourceFilter === s.value ? 'bg-neon-cyan/10 text-neon-cyan' : 'text-text-muted hover:text-text-primary hover:bg-white/5'}`}
                    ><span>{s.icon}</span> {s.label}</button>
                  ))}
                </div>
              )}
            </div>

            {/* 时间 */}
            <div className="relative">
              <button onClick={() => setOpenDropdown(prev => prev === 'time' ? null : 'time')}
                className={`px-2.5 py-1.5 text-[11px] font-mono border rounded cursor-pointer transition-all whitespace-nowrap
                  ${timeRange !== 'all' ? 'bg-neon-yellow/10 text-neon-yellow border-neon-yellow/30' : 'text-text-muted border-white/10 hover:border-white/30 hover:text-text-primary'}`}
              >时间: {getTimeLabel()} ▾</button>
              {openDropdown === 'time' && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-bg-card border border-white/10 rounded-lg shadow-xl p-3 min-w-[280px]">
                  <div className="flex gap-1 flex-wrap mb-2">
                    {TIME_OPTIONS.map(t => (
                      <button key={t.value} onClick={() => apply(() => { setTimeRange(t.value); setPage(1); setOpenDropdown(null); })}
                        className={`px-2 py-1 text-[10px] font-mono rounded border cursor-pointer transition-all
                          ${timeRange === t.value ? 'bg-neon-yellow/10 text-neon-yellow border-neon-yellow/30' : 'text-text-muted border-white/10 hover:border-white/20'}`}
                      >{t.label}</button>
                    ))}
                    <button onClick={() => apply(() => { setTimeRange('custom'); setPage(1); })}
                      className={`px-2 py-1 text-[10px] font-mono rounded border cursor-pointer transition-all
                        ${timeRange === 'custom' ? 'bg-neon-yellow/10 text-neon-yellow border-neon-yellow/30' : 'text-text-muted border-white/10 hover:border-white/20'}`}
                    >自定义</button>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] text-text-dim font-mono">依据:</span>
                    <button onClick={() => apply(() => { setTimeField('discovered_at'); setPage(1); })}
                      className={`px-2 py-0.5 text-[10px] font-mono rounded border cursor-pointer transition-all
                        ${timeField === 'discovered_at' ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30' : 'text-text-muted border-white/10 hover:border-white/20'}`}
                    >发现时间</button>
                    <button onClick={() => apply(() => { setTimeField('published_at'); setPage(1); })}
                      className={`px-2 py-0.5 text-[10px] font-mono rounded border cursor-pointer transition-all
                        ${timeField === 'published_at' ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30' : 'text-text-muted border-white/10 hover:border-white/20'}`}
                    >发布时间</button>
                  </div>
                  {timeRange === 'custom' && (
                    <div className="flex gap-2 items-center">
                      <input type="datetime-local" value={customSince}
                        onChange={(e) => apply(() => { setCustomSince(e.target.value); setPage(1); })}
                        className="flex-1 px-2 py-1 text-[10px] font-mono bg-bg-secondary border border-white/10 rounded text-text-primary focus:outline-none focus:border-neon-cyan/40" />
                      <span className="text-text-dim text-[10px]">~</span>
                      <input type="datetime-local" value={customUntil}
                        onChange={(e) => apply(() => { setCustomUntil(e.target.value); setPage(1); })}
                        className="flex-1 px-2 py-1 text-[10px] font-mono bg-bg-secondary border border-white/10 rounded text-text-primary focus:outline-none focus:border-neon-cyan/40" />
                    </div>
                  )}
                  <p className="text-[9px] text-text-dim font-mono mt-2">筛选依据: {timeField === 'discovered_at' ? '系统发现时间' : '原文发布时间'}</p>
                </div>
              )}
            </div>

            {/* 评分 */}
            <div className="relative">
              <button onClick={() => setOpenDropdown(prev => prev === 'score' ? null : 'score')}
                className={`px-2.5 py-1.5 text-[11px] font-mono border rounded cursor-pointer transition-all whitespace-nowrap
                  ${!(scoreMin === 0 && scoreMax === 100) ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30' : 'text-text-muted border-white/10 hover:border-white/30 hover:text-text-primary'}`}
              >评分: {getScoreLabel()} ▾</button>
              {openDropdown === 'score' && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-bg-card border border-white/10 rounded-lg shadow-xl p-3 min-w-[230px]">
                  <div className="flex gap-1 flex-wrap mb-3">
                    {SCORE_PRESETS.map(p => (
                      <button key={p.label} onClick={() => apply(() => { setScoreMin(p.min); setScoreMax(p.max); setPage(1); setOpenDropdown(null); })}
                        className={`px-2 py-1 text-[10px] font-mono rounded border cursor-pointer transition-all
                          ${scoreMin === p.min && scoreMax === p.max ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30' : 'text-text-muted border-white/10 hover:border-white/20'}`}
                      >{p.label}</button>
                    ))}
                  </div>
                  <div className="flex gap-2 items-center">
                    <input type="range" min={0} max={100} value={scoreMin}
                      onChange={(e) => apply(() => setScoreMin(Math.min(Number(e.target.value), scoreMax)))}
                      className="flex-1 h-1.5 accent-neon-cyan cursor-pointer" />
                    <span className="text-text-dim text-[10px] font-mono w-8 text-right">{scoreMin}</span>
                  </div>
                  <div className="flex gap-2 items-center mt-1">
                    <input type="range" min={0} max={100} value={scoreMax}
                      onChange={(e) => apply(() => setScoreMax(Math.max(Number(e.target.value), scoreMin)))}
                      className="flex-1 h-1.5 accent-neon-cyan cursor-pointer" />
                    <span className="text-text-dim text-[10px] font-mono w-8 text-right">{scoreMax}</span>
                  </div>
                </div>
              )}
            </div>

            {/* 关键词 */}
            <div className="relative">
              <button onClick={() => setOpenDropdown(prev => prev === 'keyword' ? null : 'keyword')}
                className={`px-2.5 py-1.5 text-[11px] font-mono border rounded cursor-pointer transition-all whitespace-nowrap
                  ${selectedKeywordIds.length > 0 ? 'bg-neon-magenta/10 text-neon-magenta border-neon-magenta/30' : 'text-text-muted border-white/10 hover:border-white/30 hover:text-text-primary'}`}
              >关键词: {getKeywordLabel()} ▾</button>
              {openDropdown === 'keyword' && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-bg-card border border-white/10 rounded-lg shadow-xl p-2 min-w-[180px] max-h-[250px] overflow-y-auto">
                  {keywords.length === 0 && <div className="text-text-dim text-[10px] font-mono p-2 text-center">暂无关键词</div>}
                  {keywords.map(kw => (
                    <label key={kw.id} className="flex items-center gap-2 px-2 py-1.5 text-xs font-mono rounded cursor-pointer hover:bg-white/5 transition-all text-text-muted hover:text-text-primary">
                      <input type="checkbox" checked={selectedKeywordIds.includes(kw.id)}
                        onChange={() => apply(() => { setSelectedKeywordIds(prev => prev.includes(kw.id) ? prev.filter(x => x !== kw.id) : [...prev, kw.id]); setPage(1); })}
                        className="accent-neon-magenta cursor-pointer" />
                      #{kw.keyword}
                    </label>
                  ))}
                  {selectedKeywordIds.length > 0 && (
                    <button onClick={() => apply(() => { setSelectedKeywordIds([]); setPage(1); })}
                      className="w-full text-left px-2 py-1 mt-1 text-[10px] font-mono text-neon-red/70 hover:text-neon-red rounded cursor-pointer transition-all">清除全部</button>
                  )}
                </div>
              )}
            </div>

            {/* 排序 */}
            <div className="relative">
              <button onClick={() => setOpenDropdown(prev => prev === 'sort' ? null : 'sort')}
                className={`px-2.5 py-1.5 text-[11px] font-mono border rounded cursor-pointer transition-all whitespace-nowrap text-text-muted border-white/10 hover:border-white/30 hover:text-text-primary`}
              >{getSortLabel()} ▾</button>
              {openDropdown === 'sort' && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-bg-card border border-white/10 rounded-lg shadow-xl p-1.5 min-w-[140px]">
                  {SORT_OPTIONS.map(s => (
                    <button key={s.value} onClick={() => apply(() => { setSortBy(s.value); setPage(1); setOpenDropdown(null); })}
                      className={`w-full text-left px-3 py-1.5 text-xs font-mono rounded cursor-pointer transition-all
                        ${sortBy === s.value ? 'bg-neon-cyan/10 text-neon-cyan' : 'text-text-muted hover:text-text-primary hover:bg-white/5'}`}
                    >{s.label}</button>
                  ))}
                  <div className="border-t border-white/5 mt-1 pt-1">
                    <button onClick={() => apply(() => { setSortAsc(prev => !prev); setPage(1); })}
                      className={`w-full text-left px-3 py-1.5 text-xs font-mono rounded cursor-pointer transition-all
                        ${sortAsc ? 'bg-neon-cyan/10 text-neon-cyan' : 'text-text-muted hover:text-text-primary hover:bg-white/5'}`}
                    >{sortAsc ? '↑ 升序' : '↓ 降序'}</button>
                  </div>
                </div>
              )}
            </div>

            {/* 清空 */}
            {(sourceFilter !== 'all' || timeRange !== 'all' || !(scoreMin === 0 && scoreMax === 100) || selectedKeywordIds.length > 0 || search.trim() || !(sortBy === 'score' && !sortAsc)) && (
              <button onClick={resetAll}
                className="px-2 py-1.5 text-[10px] font-mono text-neon-red/70 hover:text-neon-red border border-neon-red/20 hover:border-neon-red/40 rounded cursor-pointer transition-all whitespace-nowrap">清空 ✕</button>
            )}
          </div>

          {/* 筛选标签 */}
          {filterTags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mt-2 pb-2">
              <span className="text-[9px] text-text-dim font-mono uppercase tracking-wider">已选:</span>
              {filterTags.map(tag => (
                <span key={tag.key} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono bg-white/5 border border-white/10 rounded text-text-muted">
                  {tag.label}
                  <button onClick={tag.onRemove} className="text-text-dim hover:text-neon-red cursor-pointer transition-all ml-0.5">✕</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 每页条数 + 匹配计数 */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] text-text-dim font-mono">匹配: <span className="text-neon-cyan">{stats.filtered}</span> / {stats.total}</div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-text-dim font-mono">每页</span>
            {PAGE_SIZES.map(s => (
              <button key={s} onClick={() => apply(() => { setPageSize(s); setPage(1); })}
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded border cursor-pointer transition-all
                  ${pageSize === s ? 'bg-neon-green/10 text-neon-green border-neon-green/30' : 'text-text-muted border-white/10 hover:border-white/20'}`}
              >{s}</button>
            ))}
          </div>
        </div>

        {/* 热点列表 */}
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-24 bg-bg-secondary rounded-lg animate-pulse border border-white/5" />)}</div>
        ) : hotspots.length === 0 ? (
          <CyberCard className="text-center py-16">
            <div className="text-4xl mb-3 opacity-20">◈</div>
            <NeonText color="cyan" className="text-base">
              {search ? `未找到"${search}"相关热点` : '暂无热点数据，请先添加监控词并采集'}
            </NeonText>
            <p className="text-text-muted text-xs mt-2 font-mono">调整筛选条件或点击导航栏「立即采集」开始监控</p>
          </CyberCard>
        ) : (
          <div className="space-y-3">
            {hotspots.map(h => (
              <HotspotCard key={h.id} title={h.title} summary={h.summary}
                rawContent={h.raw_content}
                sourceType={h.source_type}
                sourceUrl={h.source_url} sourceAuthor={h.source_author}
                aiScore={h.ai_score} aiVerified={h.ai_verified}
                aiAnalysis={h.ai_analysis}
                publishedAt={h.published_at}
                discoveredAt={h.discovered_at}
                keyword={h.keyword_id ? keywordMap[h.keyword_id] : undefined} />
            ))}
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5">
            <div className="text-[10px] text-text-dim font-mono">共 {stats.filtered} 条 · 第 {page}/{totalPages} 页</div>
            <div className="flex items-center gap-1">
              <button onClick={() => apply(() => setPage(1))} disabled={page <= 1}
                className="px-2 py-1 text-[10px] font-mono border border-white/10 rounded text-text-muted hover:text-text-primary hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all">首页</button>
              <button onClick={() => apply(() => setPage(p => Math.max(1, p - 1)))} disabled={page <= 1}
                className="px-2 py-1 text-[10px] font-mono border border-white/10 rounded text-text-muted hover:text-text-primary hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all">上一页</button>
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                let pn: number;
                if (totalPages <= 7) pn = i + 1;
                else if (page <= 4) pn = i + 1;
                else if (page >= totalPages - 3) pn = totalPages - 6 + i;
                else pn = page - 3 + i;
                return <button key={pn} onClick={() => apply(() => setPage(pn))}
                  className={`w-7 h-7 text-[10px] font-mono rounded border cursor-pointer transition-all ${pn === page ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30' : 'text-text-muted border-white/10 hover:border-white/20'}`}>{pn}</button>;
              })}
              <button onClick={() => apply(() => setPage(p => Math.min(totalPages, p + 1)))} disabled={page >= totalPages}
                className="px-2 py-1 text-[10px] font-mono border border-white/10 rounded text-text-muted hover:text-text-primary hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all">下一页</button>
              <button onClick={() => apply(() => setPage(totalPages))} disabled={page >= totalPages}
                className="px-2 py-1 text-[10px] font-mono border border-white/10 rounded text-text-muted hover:text-text-primary hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all">末页</button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}