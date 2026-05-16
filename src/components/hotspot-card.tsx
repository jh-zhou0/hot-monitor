'use client';

import { useState } from 'react';
import { CyberCard } from './ui/cyber-card';
import { SourceType } from '@/types';

interface HotspotCardProps {
  title: string;
  summary: string | null;
  rawContent: string | null;
  sourceType: SourceType;
  sourceUrl: string | null;
  sourceAuthor: string | null;
  aiScore: number;
  aiVerified: number;
  aiAnalysis: string | null;
  publishedAt: string | null;
  discoveredAt: string;
  keyword?: string;
}

const SOURCE_META: Record<SourceType, { icon: string; label: string }> = {
  bing:        { icon: '🔍', label: 'Bing' },
  duckduckgo:  { icon: '🦆', label: 'DDG' },
  google:      { icon: 'G',  label: 'Google' },
  sogou:       { icon: '搜', label: '搜狗' },
  hackernews:  { icon: '▲',  label: 'HN' },
  weibo:       { icon: '微', label: '微博' },
  twitter:     { icon: '𝕏',  label: 'Twitter' },
};

function getLevel(score: number): { label: string; color: string; bg: string } {
  if (score >= 80) return { label: '高', color: 'text-neon-yellow', bg: 'border-neon-yellow/40 bg-neon-yellow/5' };
  if (score >= 50) return { label: '中', color: 'text-neon-cyan',   bg: 'border-neon-cyan/40 bg-neon-cyan/5' };
  return              { label: '低', color: 'text-text-muted',    bg: 'border-white/15 bg-white/3' };
}

export function HotspotCard({
  title,
  summary,
  rawContent,
  sourceType,
  sourceUrl,
  sourceAuthor,
  aiScore,
  aiAnalysis,
  publishedAt,
  discoveredAt,
  keyword,
}: HotspotCardProps) {
  const level = getLevel(aiScore);
  const sourceMeta = SOURCE_META[sourceType] || { icon: '◈', label: sourceType };
  const timeAgo = getTimeAgo(discoveredAt);
  const scoreColor = aiScore >= 80 ? 'text-neon-yellow' : aiScore >= 50 ? 'text-neon-cyan' : 'text-text-muted';

  // 分析理由展开/折叠
  const [showAnalysis, setShowAnalysis] = useState(false);

  // 描述来源判断
  const descriptionLabel = summary && rawContent && rawContent !== summary ? 'AI 摘要' : '描述';

  // 格式化绝对时间
  function formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${mins}`;
  }

  // 发布时间 vs 发现时间的差值
  function getDiscoveryDelay(): string | null {
    if (!publishedAt) return null;
    const pub = new Date(publishedAt).getTime();
    const disc = new Date(discoveredAt).getTime();
    if (isNaN(pub) || isNaN(disc)) return null;
    const diffMs = disc - pub;
    if (diffMs < 0) return null; // 发布时间晚于发现时间（可能时区差异）
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 60) return `${diffMin}分钟`;
    const diffHours = Math.floor(diffMin / 60);
    const remainMin = diffMin % 60;
    if (diffHours < 24) return remainMin > 0 ? `${diffHours}小时${remainMin}分钟` : `${diffHours}小时`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}天`;
  }

  const delay = getDiscoveryDelay();

  return (
    <CyberCard glowColor={aiScore >= 80 ? 'magenta' : 'cyan'} className="group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* 标签行 */}
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            <span className={`text-[10px] font-mono font-bold border px-1.5 py-0.5 rounded ${level.color} ${level.bg}`}>
              {level.label === '高' ? '⚡' : level.label === '中' ? '◈' : '·'} {level.label}
            </span>
            <span className="text-[10px] font-mono text-text-muted border border-text-muted/40 bg-white/5 px-1.5 py-0.5 rounded">
              {sourceMeta.icon} {sourceMeta.label}
            </span>
            <span className={`text-[10px] font-mono border px-1.5 py-0.5 rounded ${level.color} ${level.bg}`}>
              匹配 {aiScore}%
            </span>
            {keyword && (
              <span className="text-[10px] font-mono text-neon-magenta/70 border border-neon-magenta/20 px-1.5 py-0.5 rounded">
                #{keyword}
              </span>
            )}
            {sourceAuthor && (
              <span className="text-[10px] text-text-muted truncate max-w-[100px]">@{sourceAuthor}</span>
            )}
          </div>

          {/* 标题 */}
          <h3 className="text-sm font-medium text-text-primary group-hover:text-neon-cyan transition-colors line-clamp-2 leading-snug">
            {title}
          </h3>

          {/* AI 摘要 / 原始描述 */}
          {(summary || rawContent) && (
            <div className="mt-1.5">
              <span className="text-[9px] font-mono text-text-dim bg-white/5 px-1 py-0.5 rounded uppercase tracking-wider">{descriptionLabel}</span>
              <p className="mt-0.5 text-xs text-text-muted line-clamp-2 leading-relaxed">
                {summary || rawContent}
              </p>
            </div>
          )}

          {/* AI 分析理由（展开/折叠） */}
          {aiAnalysis && (
            <div className="mt-2">
              <button
                onClick={() => setShowAnalysis(prev => !prev)}
                className="flex items-center gap-1 text-[10px] font-mono text-neon-cyan/50 hover:text-neon-cyan transition-colors cursor-pointer"
              >
                <span className={`transition-transform duration-200 ${showAnalysis ? 'rotate-90' : ''}`}>▶</span>
                分析理由 {showAnalysis ? '收起' : '展开'}
              </button>
              {showAnalysis && (
                <div className="mt-1.5 text-xs text-text-muted/80 bg-white/3 border border-white/5 rounded-lg p-2.5 leading-relaxed">
                  {aiAnalysis}
                </div>
              )}
            </div>
          )}

          {/* 时间行 */}
          <div className="mt-2 flex items-center gap-3 text-[10px] text-text-dim flex-wrap">
            {publishedAt && (
              <span title={`原文发布时间: ${formatTime(publishedAt)}`}>
                📅 发布于 {formatTime(publishedAt)}
              </span>
            )}
            <span title={`系统发现时间: ${formatTime(discoveredAt)}`}>
              🔍 {timeAgo}发现
            </span>
            {delay && (
              <span className="text-neon-yellow/50" title={`从发布到被系统抓取间隔 ${delay}`}>
                ⏱ +{delay}
              </span>
            )}
            {sourceUrl && (
              <a href={sourceUrl} target="_blank" rel="noopener noreferrer"
                className="text-neon-cyan/50 hover:text-neon-cyan transition-colors ml-auto">
                原文 →
              </a>
            )}
          </div>
        </div>

        {/* 评分 */}
        <div className="flex-shrink-0 text-right">
          <div className={`text-xl font-display font-bold ${scoreColor}`}>{aiScore}</div>
          <div className="text-[9px] text-text-dim uppercase tracking-wider">score</div>
        </div>
      </div>
    </CyberCard>
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