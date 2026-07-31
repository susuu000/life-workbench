/** ===== 用户与认证 ===== */
export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

/** ===== 打卡 ===== */
export interface CheckinRecord {
  id: string;
  user_id: string;
  date: string;            // YYYY-MM-DD
  streak_days: number;     // 连续天数（计算值）
  total_days: number;      // 累计天数
}

/** ===== 核心板块任务 ===== */
export type ModuleKey =
  | 'english'
  | 'ai_learning'
  | 'reading'
  | 'podcast'
  | 'social_media'
  | 'self_explore';

export const MODULE_META: Record<ModuleKey, { label: string; icon: string }> = {
  english:       { label: '英语',        icon: '📖' },
  ai_learning:   { label: 'AI学习',      icon: '🤖' },
  reading:       { label: '阅读',        icon: '📚' },
  podcast:       { label: '播客',        icon: '🎙️' },
  social_media:  { label: '自媒体',      icon: '📸' },
  self_explore:  { label: '自我探索',    icon: '✨' },
};

export interface Task {
  id: string;
  user_id: string;
  module: ModuleKey;
  title: string;
  sub_module?: string;     // 子模块名，如"单词学习"/"每日外刊听力"
  done: boolean;
  completed_at?: string;
  review_note?: string;    // 复盘输入行
  order_index: number;
}

/** ===== 英语板块 ===== */
export interface EnglishWordTask extends Task {
  daily_target: number;    // 默认 15
  source_link?: string;    // 墨墨背单词跳转链接
}
export interface ListeningArticle {
  id: string;
  title: string;
  audio_url: string;
  transcript: string;
  translation: string;
  date: string;
}

/** ===== AI 学习板块 ===== */
export interface AIInsight {
  id: string;
  type: 'news' | 'parse' | 'video';
  content: string;
  highlights: string;
  shortcomings: string;
  value_summary: string;
  source_url: string;
  published_at: string;
  reading_feeling?: string;
}
export interface AIKnowledgeItem {
  id: string;
  category: 'ai_office' | 'ai_comic' | 'ai_build';
  prompt_formula: string;
  four_elements: string;
  summary: string;
  core_tip: string;
  collected: boolean;
}

/** ===== 阅读板块 ===== */
export type ReadingType = 'book' | 'movie';
export interface BookMovieEntry {
  id: string;
  type: ReadingType;
  title: string;
  author?: string;
  translator?: string;
  publisher?: string;
  description: string;
  cover_url: string;
  characters?: string;     // 人物角色梳理线
  total_pages?: number;
  total_episodes?: number;
  current_page?: number;
  current_episode?: number;
  status: 'reading' | 'planned' | 'completed';
  duration_ms?: number;    // 总耗时
  completed_at?: string;
  recommendation_url?: string; // B站解说跳转
}
export interface ReadingCheckin {
  id: string;
  entry_id: string;
  entry_type: ReadingType;
  date: string;
}

/** ===== 播客板块 ===== */
export interface PodcastItem {
  id: string;
  name: string;
  episode_title: string;
  summary: string;
  play_url: string;
  source: 'xiaoyuzhou_hot' | 'my_follows';
  week_of: string;
}

/** ===== 自媒体板块 ===== */
export interface SocialMediaRec {
  id: string;
  type: 'today_rec' | 'inspiration' | 'aesthetic';
  title: string;
  content: string;
  traffic_analysis?: string;
  image_url?: string;
  source_url?: string;
  platform: 'xiaohongshu' | 'douyin' | 'other';
  published_at: string;
}

/** ===== 自我探索板块 ===== */
export interface MoodRecord {
  id: string;
  user_id: string;
  date: string;
  emotion: string;         // emoji / 文字描述
}
export interface AppearanceRecord {
  id: string;
  user_id: string;
  date: string;
  type: 'ootd' | 'hairstyle' | 'weight';
  image_url: string;
  note?: string;
}
export interface ClothesRecord {
  id: string;
  user_id: string;
  source_url: string;      // 淘宝/小红书链接
  style: string;
  price: number;
  category: string;
}
export interface DailyRecord {
  id: string;
  user_id: string;
  date: string;
  type: 'outdoor' | 'cooking' | 'cleaning' | 'custom';
  custom_label?: string;
  photo_url?: string;
  done: boolean;
}
export interface NewSkill {
  id: string;
  user_id: string;
  skill_name: string;
  learned_at: string;
  notes?: string;
}
export interface PeriodRecord {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  predicted_next?: string;
}
export interface FinanceRecord {
  id: string;
  user_id: string;
  amount: number;
  category: string;
  note: string;
  is_large: boolean;
  recorded_at: string;
}
export interface JournalEntry {
  id: string;
  user_id: string;
  images: string[];        // 云存储 URL 数组
  text?: string;
  created_at: string;
}

/** ===== 发现 · 资讯缓存 ===== */
export interface NewsItem {
  id: string;
  source: 'xinhua' | 'renmin' | 'other';
  title: string;
  url: string;
  summary?: string;
  published_at: string;
}
export interface AIFrontierItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  published_at: string;
}
export interface StockSectorInfo {
  sector: string;
  change_pct: number;
  data_date: string;
}
export interface BookMovieNew {
  id: string;
  type: ReadingType;
  title: string;
  author: string;
  source: 'douban' | 'letterboxd' | 'tmdb';
  url: string;
  published_at: string;
  poster_url?: string | null;
  rating?: number | null;
}

/** ===== 收藏（统一归集） ===== */
export interface CollectionItem {
  id: string;
  user_id: string;
  category: string;       // 板块分类
  ref_table: string;      // 来源表名
  ref_id: string;
  collected_at: string;
}

/** ===== 设置 ===== */
export interface UserSettings {
  id: string;
  user_id: string;
  theme_color: string;
  font_size: number;
  module_order: ModuleKey[];
  app_icon_url: string | null;
  app_name: string;
  weather_city: string | null;
  weather_enabled: boolean;
  last_refresh_at: string | null;
  daily_refresh_enabled: boolean;
}

/** ===== 天气缓存 ===== */
export interface WeatherCache {
  city: string;
  temp: number;
  condition: string;
  icon_code: string;
  forecast: DailyForecast[];
  updated_at: string;
}
export interface DailyForecast {
  date: string;
  temp_max: number;
  temp_min: number;
  condition: string;
  icon_code: string;
}
