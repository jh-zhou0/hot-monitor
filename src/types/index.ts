export interface Keyword {
  id: number;
  keyword: string;
  category: string;
  is_active: number;
  check_interval: number;
  last_checked_at: string | null;
  created_at: string;
}

export interface Hotspot {
  id: number;
  title: string;
  summary: string | null;
  source_type: SourceType;
  source_url: string | null;
  source_author: string | null;
  raw_content: string | null;
  ai_score: number;
  ai_verified: number;
  ai_analysis: string | null;
  keyword_id: number | null;
  is_notified: number;
  published_at: string | null;
  discovered_at: string;
}

export interface PushSubscription {
  id: number;
  endpoint: string;
  keys_p256dh: string;
  keys_auth: string;
  created_at: string;
}

export interface NotificationSettings {
  id: number;
  email: string | null;
  min_score: number;
  push_enabled: number;
  email_enabled: number;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

export type SourceType = 'bing' | 'duckduckgo' | 'google' | 'sogou' | 'hackernews' | 'weibo' | 'twitter';

export interface RawSearchResult {
  title: string;
  url: string;
  snippet: string;
  source_type: SourceType;
  author?: string;
  published_at?: string;
}

export interface AIAnalysisResult {
  is_genuine: boolean;
  score: number;
  summary: string;
  analysis: string;
}

export interface MonitorStatus {
  is_running: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  active_keywords: number;
  total_hotspots: number;
}
