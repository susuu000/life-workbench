/**
 * Daily Refresh - 每日自动刷新工具
 * 
 * 用于在午夜自动刷新打卡数据。
 * 在首页加载时调用 ensureDailyRefresh()。
 */

const REFRESH_KEY = 'yuexi_last_refresh_date';

/** 确保今日已刷新（跨午夜自动触发） */
export function ensureDailyRefresh(): boolean {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    const lastRefresh = localStorage.getItem(REFRESH_KEY);
    if (lastRefresh !== today) {
      localStorage.setItem(REFRESH_KEY, today);
      return true; // 触发刷新
    }
  } catch {
    // localStorage 不可用时跳过
  }
  
  return false;
}

/** 获取上次刷新日期 */
export function getLastRefreshDate(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}
