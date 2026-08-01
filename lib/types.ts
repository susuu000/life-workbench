/**
 * 月夕生活台 · 全局类型定义
 */

// ===== 板块相关 =====

/** 内置板块 key */
export type ModuleKey = 'english' | 'ai_learning' | 'reading' | 'podcast' | 'social_media' | 'self_explore';

/** 板块元数据 */
export interface ModuleMeta {
  label: string;
  icon: string;
  color: string;
  description: string;
}

/** 板块元数据映射 */
export const MODULE_META: Record<ModuleKey, ModuleMeta> = {
  english:      { label: '英语学习', icon: '📚', color: '#2E6F7E', description: '每日英语积累' },
  ai_learning:  { label: 'AI 学习',  icon: '🤖', color: '#D4A847', description: '人工智能探索' },
  reading:      { label: '书影记录', icon: '📖', color: '#8B6F47', description: '读书与观影' },
  podcast:      { label: '播客笔记', icon: '🎙️', color: '#7B3FF2', description: '播客收听记录' },
  social_media: { label: '自媒体',   icon: '📸', color: '#C04830', description: '内容创作管理' },
  self_explore: { label: '自我探索', icon: '🌙', color: '#1A5060', description: '内观与成长' },
};

/** 所有板块 key 列表 */
export const ALL_MODULE_KEYS: ModuleKey[] = [
  'english', 'ai_learning', 'reading', 'podcast', 'social_media', 'self_explore',
];

// ===== 用户设置 =====

export interface UserSettings {
  user_id: string;
  dark_mode: boolean;
  follow_system_theme: boolean;
  module_keys: ModuleKey[];
  font_size: 'small' | 'normal' | 'large';
  created_at?: string;
  updated_at?: string;
}

// ===== 打卡 =====

export interface CheckIn {
  id: string;
  user_id: string;
  module_key: ModuleKey;
  date: string;
  note?: string;
  duration_minutes?: number;
  created_at: string;
}

// ===== 书影 =====

export type ReadingType = 'book' | 'movie';

export interface ReadingItem {
  id: string;
  user_id: string;
  type: ReadingType;
  title: string;
  author?: string;       // 书籍作者
  director?: string;     // 影视导演
  cover_url?: string;
  status: 'wish' | 'reading' | 'done';
  rating?: number;
  pages?: number;        // 书籍页数
  episodes?: number;     // 影视集数
  current_page?: number;
  current_episode?: number;
  notes?: string;
  douban_url?: string;
  created_at: string;
  updated_at: string;
}

/**
 * BookMovieEntry - 数据库返回的书影条目类型
 * 字段名使用 snake_case（与 Supabase 列名一致）
 */
export interface BookMovieEntry {
  id: string;
  user_id: string;
  type: ReadingType;
  title: string;
  author?: string;
  director?: string;
  cover_url?: string;
  description?: string;
  recommendation_url?: string;
  status: 'reading' | 'planned' | 'completed';
  rating?: number;
  total_pages?: number;
  total_episodes?: number;
  current_page?: number;
  current_episode?: number;
  notes?: string;
  douban_url?: string;
  created_at: string;
  updated_at: string;
}

// ===== 便签 =====

export type StickyColor = 'yellow' | 'green' | 'pink' | 'blue' | 'purple' | 'orange' | 'teal' | 'gray';

export interface StickyNote {
  id: string;
  user_id: string;
  content: string;
  color: StickyColor;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

// ===== 金句 =====

export interface DailyQuote {
  id: string;
  text: string;
  author: string;
  source?: string;
}

export interface FavoriteQuote {
  id: string;
  user_id: string;
  quote_text: string;
  quote_author: string;
  created_at: string;
}

// ===== 自定义板块 =====

export interface CustomModule {
  id: string;
  user_id: string;
  name: string;
  icon?: string;
  sort_order: number;
  created_at: string;
}

// ===== 导出 =====

export interface DataExport {
  version: string;
  exported_at: string;
  user_id: string;
  checkins: CheckIn[];
  reading_items: ReadingItem[];
  sticky_notes: StickyNote[];
  favorite_quotes: FavoriteQuote[];
  custom_modules: CustomModule[];
}
