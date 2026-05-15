'use client';

import { CyberCard } from './ui/cyber-card';
import { SourceType } from '@/types';

interface HotspotCardProps {
  title: string;
  summary: string | null;
  sourceType: SourceType;
  sourceUrl: string | null;
  sourceAuthor: string | null;
  aiScore: number;
  aiVerified: number;
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
  sourceType,
  sourceUrl,
  sourceAuthor,
  aiScore,
  discoveredAt,
  keyword,
}: HotspotCardProps) {
  const level = getLevel(aiScore);
  const sourceMeta = SOURCE_META[sourceType] || { icon: '◈', label: sourceType };
  const timeAgo = getTimeAgo(discoveredAt);
  const scoreColor = aiScore >= 80 ? 'text-neon-yellow' : aiScore >= 50 ? 'text-neon-cyan' : 'text-text-muted';

  return (
    <CyberCard glowColor={aiScore >= 80 ? 'magenta' : 'cyan'} className="group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            {/* 热点等级 */}
            <span className={`text-[10px] font-mono font-bold border px-1.5 py-0.5 rounded ${level.color} ${level.bg}`}>
              {level.label === '高' ? '⚡' : level.label === '中' ? '◈' : '·'} {level.label}
            </span>
            {/* 来源 */}
            <span className="text-[10px] font-mono text-text-dim border border-text-dim/20 px-1.5 py-0.5 rounded">
              {sourceMeta.icon} {sourceMeta.label}
            </span>
            {/* 匹配度 */}
            <span className={`text-[10px] font-mono border px-1.5 py-0.5 rounded ${level.color} ${level.bg}`}>
              匹配 {aiScore}%
            </span>
            {/* 监控词 */}
            {keyword && (
              <span className="text-[10px] font-mono text-neon-magenta/70 border border-neon-magenta/20 px-1.5 py-0.5 rounded">
                #{keyword}
              </span>
            )}
            {sourceAuthor && (
              <span className="text-[10px] text-text-muted truncate max-w-[100px]">@{sourceAuthor}</span>
            )}
          </div>

          <h3 className="text-sm font-medium text-text-primary group-hover:text-neon-cyan transition-colors line-clamp-2 leading-snug">
            {title}
          </h3>

          {summary && (
            <p className="mt-1.5 text-xs text-text-muted line-clamp-2 leading-relaxed">{summary}</p>
          )}

          <div className="mt-2 flex items-center gap-3 text-[10px] text-text-dim">
            <span>{timeAgo}</span>
            {sourceUrl && (
              <a href={sourceUrl} target="_blank" rel="noopener noreferrer"
                className="text-neon-cyan/50 hover:text-neon-cyan transition-colors">
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
