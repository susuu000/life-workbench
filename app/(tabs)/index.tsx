/**
 * 生活工作台 v3 · 首页
 * 
 * 融合优化：
 * - CodeBuddy 版渐变秘色背景 + 大字日期/星期展示
 * - CodeBuddy 版左侧栏（秘色渐变 + 金色左边条激活态 + 自定义板块）
 * - CodeBuddy 版底部导航（SVG 图标 + 选中态缩放动画）
 * - GitHub Pages 版完整功能（六大板块 + 打卡 + 天气 + 发现/我的）
 * - 新增：卡片阴影层次、打卡动画、骨架屏加载
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  RefreshControl, Alert, Animated, Platform, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase, getCurrentUserId, SUPABASE_URL, SUPABASE_ANON_KEY, checkCloudConnection } from '@/lib/supabase';
import { ensureDailyRefresh } from '@/lib/refresh';
import { Colors, Spacing, FontSize, BorderRadius, ModuleColors } from '@/lib/theme';
import { useDarkMode } from '@/lib/DarkModeProvider';
import { MODULE_META, type ModuleKey } from '@/lib/types';
import FlipClock from '@/components/FlipClock';
import CalendarModal from '@/components/CalendarModal';
import WeatherForecastModal, { ForecastDay } from '@/components/WeatherForecastModal';
import SidebarV3, { CustomSection, persistCustomSections } from '@/components/SidebarV3';
import SkeletonLoader from '@/components/SkeletonLoader';

// ===== 类型 =====
interface ModuleProgress {
  done: number;
  total: number;
}

interface CheckinData {
  streakDays: number;
  totalDays: number;
  todayChecked: boolean;
}

// 默认每日目标
const DEFAULT_TARGETS: Record<ModuleKey, number> = {
  english: 4,
  ai_learning: 2,
  reading: 0,
  podcast: 5,
  social_media: 2,
  self_explore: 3,
};

// 板块子任务定义（对齐 CodeBuddy 版 subSections）
const SUB_SECTIONS: Record<ModuleKey, { id: string; name: string }[]> = {
  english: [
    { id: 'vocabulary', name: '单词学习' },
    { id: 'dialogue', name: '英语对话' },
    { id: 'bbc', name: '外刊听力' },
    { id: 'duolingo', name: '多邻国' },
  ],
  ai_learning: [
    { id: 'news', name: 'AI前沿资讯' },
    { id: 'kb', name: 'AI知识库' },
  ],
  reading: [
    { id: 'bookmedia', name: '书影' },
    { id: 'gzh', name: '公众号精选' },
    { id: 'sanlian', name: '三联中读' },
  ],
  podcast: [
    { id: 'hot', name: '热榜Top5' },
    { id: 'follow', name: '关注更新' },
  ],
  social_media: [
    { id: 'reco', name: '今日推荐' },
    { id: 'inspiration', name: '今日灵感' },
    { id: 'aesthetic', name: '审美搭建' },
  ],
  self_explore: [
    { id: 'self', name: '今日状态' },
    { id: 'daily', name: '日常记录' },
    { id: 'skill', name: '新技能' },
  ],
};

// ===== 子组件 =====

/** 全局搜索框 */
function SearchBar({ onSearch }: { onSearch?: (text: string) => void }) {
  return (
    <View style={styles.searchWrap}>
      <Text style={styles.searchIcon}>🔎</Text>
      <TextInput
        style={styles.searchInput}
        placeholder="搜索所有板块内容…"
        placeholderTextColor={Colors.textMuted}
        onChangeText={(text) => onSearch?.(text)}
      />
    </View>
  );
}

/** 天气图标映射 */
function weatherEmoji(condition: string): string {
  if (/雨|雪|雷|雾|霾/.test(condition)) return '🌧️';
  if (/阴/.test(condition)) return '☁️';
  if (/多云|云/.test(condition)) return '⛅';
  if (/晴/.test(condition)) return '☀️';
  return '🌤️';
}

/** 打卡卡片（带完成动画） */
function CheckinCard({ data, colors }: { data: CheckinData | null; colors: { gold: string } }) {
  const display = data ?? { streakDays: 0, totalDays: 0, todayChecked: false };
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [prevChecked, setPrevChecked] = useState(display.todayChecked);

  useEffect(() => {
    if (display.todayChecked && !prevChecked) {
      // 打卡完成弹跳动画
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.15, duration: 200, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
    setPrevChecked(display.todayChecked);
  }, [display.todayChecked]);

  return (
    <Animated.View style={[styles.checkinCard, { transform: [{ scale: scaleAnim }] }]}>
      <View style={styles.checkinLeft}>
        <Text style={styles.checkinTitle}>今日打卡</Text>
        <View style={styles.checkinStats}>
          <Text style={styles.checkinStat}>
            <Text style={[styles.checkinNum, { color: colors.gold }]}>{display.streakDays}</Text> 天连续
          </Text>
          <Text style={[styles.checkinStat, styles.checkinStatGap]}>
            累计 <Text style={[styles.checkinNum, { color: colors.gold }]}>{display.totalDays}</Text> 天
          </Text>
        </View>
        <Text style={styles.checkinHint}>
          {display.todayChecked ? '今日已自动打卡 ✨' : '学习任意板块后将自动打卡'}
        </Text>
      </View>
      <View style={[styles.checkinBadge, display.todayChecked && styles.checkinBadgeDone]}>
        <Text style={styles.checkinIcon}>{display.todayChecked ? '✅' : '📋'}</Text>
      </View>
    </Animated.View>
  );
}

// ===== 首页主屏 =====

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useDarkMode();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkinData, setCheckinData] = useState<CheckinData | null>(null);
  const [moduleTargets, setModuleTargets] = useState<Record<ModuleKey, number>>(DEFAULT_TARGETS);
  const [moduleProgress, setModuleProgress] = useState<Record<ModuleKey, ModuleProgress>>({
    english: { done: 0, total: 0 },
    ai_learning: { done: 0, total: 0 },
    reading: { done: 0, total: 0 },
    podcast: { done: 0, total: 0 },
    social_media: { done: 0, total: 0 },
    self_explore: { done: 0, total: 0 },
  });
  const [expandedModule, setExpandedModule] = useState<ModuleKey | null>(null);

  // 日期（大字展示 + 星期，对齐 CodeBuddy 版）
  const [dateStr, setDateStr] = useState('');
  const [weekdayStr, setWeekdayStr] = useState('');
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
      setDateStr(`${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`);
      setWeekdayStr(`星期${weekdays[now.getDay()]}`);
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  // 日历弹窗
  const [showCalendar, setShowCalendar] = useState(false);

  // 天气
  const [weatherCity, setWeatherCity] = useState('宁波');
  const [weatherTemp, setWeatherTemp] = useState<number | null>(null);
  const [weatherCond, setWeatherCond] = useState('');
  const [weatherIcon, setWeatherIcon] = useState('☀️');
  const [weatherForecast, setWeatherForecast] = useState<ForecastDay[]>([]);
  const [showWeatherModal, setShowWeatherModal] = useState(false);

  // 云端同步状态
  const [cloudStatus, setCloudStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');

  // 侧边栏（CodeBuddy 版风格）
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [customSections, setCustomSections] = useState<CustomSection[]>([]);

  // 打卡动画
  const checkinPulse = useRef(new Animated.Value(1)).current;

  // ---- 加载个性化设置 ----
  const loadSettings = useCallback(async () => {
    const uid = await getCurrentUserId();
    if (!uid) return;
    const { data: s } = await supabase
      .from('user_settings')
      .select('module_targets, custom_sections, weather_city')
      .eq('user_id', uid)
      .maybeSingle();
    if (s?.module_targets) setModuleTargets((prev) => ({ ...prev, ...s.module_targets }));
    if (s?.custom_sections) setCustomSections(s.custom_sections as CustomSection[]);
    if (s?.weather_city) setWeatherCity(s.weather_city);
  }, []);

  // ---- 云端状态检测 ----
const checkCloud = useCallback(async () => {
  setCloudStatus('checking');
  try {
    const connected = checkCloudConnection();
    if (!connected) {
      setCloudStatus('disconnected');
      return;
    }
    // 进一步验证：尝试获取当前用户 session
    const uid = await getCurrentUserId();
    setCloudStatus(uid ? 'connected' : 'disconnected');
  } catch {
    setCloudStatus('disconnected');
  }
}, []);

  useEffect(() => { checkCloud(); const id = setInterval(checkCloud, 30000); return () => clearInterval(id); }, [checkCloud]);

  // ---- 天气加载 ----
  useEffect(() => {
    let active = true;
    (async () => {
      const uid = await getCurrentUserId();
      let c = '宁波';
      if (uid) {
        const { data: s } = await supabase
          .from('user_settings').select('weather_city').eq('user_id', uid).maybeSingle();
        c = s?.weather_city || '宁波';
        if (active) setWeatherCity(c);
      }
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/get-weather?city=${encodeURIComponent(c)}`,
        { headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      ).then((r) => r.json());
      if (res?.ok && res.data && active) {
        setWeatherTemp(res.data.temp);
        setWeatherCond(res.data.condition);
        setWeatherIcon(weatherEmoji(res.data.condition));
        setWeatherForecast((res.data.forecast ?? []) as ForecastDay[]);
      }
    })().catch(() => {});
    return () => { active = false; };
  }, []);

  // ---- 打卡 + 进度加载 ----
  const loadCheckin = useCallback(async () => {
    try {
      const uid = await getCurrentUserId();
      if (!uid) return;
      const today = new Date().toISOString().split('T')[0];
      const { data: tc } = await supabase
        .from('checkin_records').select('streak_days, total_days').eq('user_id', uid).eq('date', today).maybeSingle();
      if (tc) {
        setCheckinData({ streakDays: tc.streak_days, totalDays: tc.total_days, todayChecked: true });
      } else {
        const { count } = await supabase.from('checkin_records').select('*', { count: 'exact', head: true }).eq('user_id', uid);
        const { data: latest } = await supabase.from('checkin_records').select('date').eq('user_id', uid).order('date', { ascending: false }).limit(1).maybeSingle();
        let streak = 0;
        if (latest) {
          streak = 1;
          let prevDate = new Date(latest.date);
          for (let i = 1; i < 365; i++) {
            prevDate.setDate(prevDate.getDate() - 1);
            const d = prevDate.toISOString().split('T')[0];
            const { data: rec } = await supabase.from('checkin_records').select('id').eq('user_id', uid).eq('date', d).maybeSingle();
            if (!rec) break;
            streak++;
          }
        }
        setCheckinData({ streakDays: streak, totalDays: count ?? 0, todayChecked: false });
      }
    } catch (e) { console.error('loadCheckin error:', e); }
  }, []);

  const loadProgress = useCallback(async () => {
    try {
      const uid = await getCurrentUserId();
      if (!uid) return;
      const { data: tasks } = await supabase.from('tasks').select('module, done').eq('user_id', uid);
      const progress: Record<string, { done: number; total: number }> = {};
      for (const key of Object.keys(MODULE_META)) progress[key] = { done: 0, total: 0 };
      if (tasks) {
        for (const t of tasks) {
          if (progress[t.module]) {
            progress[t.module].total++;
            if (t.done) progress[t.module].done++;
          }
        }
      }
      setModuleProgress(progress as Record<ModuleKey, ModuleProgress>);
    } catch (e) { console.error('loadProgress error:', e); }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadCheckin(), loadProgress()]);
    setRefreshing(false);
  }, [loadCheckin, loadProgress]);

  useEffect(() => {
    const init = async () => {
      await Promise.all([loadCheckin(), loadProgress(), loadSettings()]);
      setLoading(false);
      ensureDailyRefresh();
    };
    init();
  }, []);

  // ---- 板块点击：一次展开子任务、二次跳详情 ----
  const handleModulePress = useCallback((key: ModuleKey) => {
    if (expandedModule === key) {
      router.push(`/(tabs)/module/${key}`);
    } else {
      setExpandedModule(key);
    }
  }, [expandedModule, router]);

  // ---- 侧边栏导航 ----
  const handleSidebarSelect = (key: string) => {
    setSidebarOpen(false);
    if (key === 'home') return;
    if (key.startsWith('custom-')) return;
    router.push(`/(tabs)/module/${key}`);
  };

  const handleCustomChange = async (next: CustomSection[]) => {
    setCustomSections(next);
    await persistCustomSections(next);
  };

  // ---- 天气切城市 ----
  const handleWeatherCityChange = (city: string) => {
    setWeatherCity(city);
    (async () => {
      const uid = await getCurrentUserId();
      if (uid) {
        await supabase.from('user_settings').update({ weather_city: city }).eq('user_id', uid);
      }
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/get-weather?city=${encodeURIComponent(city)}`,
        { headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      ).then((r) => r.json());
      if (res?.ok && res.data) {
        setWeatherTemp(res.data.temp);
        setWeatherCond(res.data.condition);
        setWeatherIcon(weatherEmoji(res.data.condition));
        setWeatherForecast((res.data.forecast ?? []) as ForecastDay[]);
      }
    })();
  };

  const moduleKeys = Object.keys(MODULE_META) as ModuleKey[];

  // ===== 渲染 =====
  return (
    <View style={{ flex: 1 }}>
      {/* CodeBuddy 风格侧边栏 */}
      <SidebarV3
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelect={handleSidebarSelect}
        custom={customSections}
        onCustomChange={handleCustomChange}
        moduleKeys={moduleKeys}
      />

      <ScrollView
        style={[styles.container, { paddingTop: insets.top }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFF" colors={['#FFFFFF']} />}
      >
        {/* ===== 渐变背景区域 ===== */}
        <View style={styles.gradientHeader}>
          {/* 顶部栏：左=菜单+日期/天气 / 右=云端+同步 */}
          <View style={styles.topBar}>
            <View style={styles.topLeft}>
              <TouchableOpacity style={styles.menuBtn} onPress={() => setSidebarOpen(true)} activeOpacity={0.7}>
                <Text style={styles.menuBtnText}>☰</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowCalendar(true)} activeOpacity={0.7}>
                <Text style={styles.dateTextSmall}>{dateStr || '...'}</Text>
                <TouchableOpacity onPress={() => setShowWeatherModal(true)} activeOpacity={0.7}>
                  <Text style={styles.weatherTextSmall}>
                    {weatherIcon} {weatherTemp != null ? `${weatherTemp}° ${weatherCond}` : '—'}
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>
            </View>
            <View style={styles.topRight}>
              <TouchableOpacity
                style={[styles.cloudBadge, cloudStatus === 'connected' ? styles.cloudConnected : styles.cloudDisconnected]}
                onPress={checkCloud}
                activeOpacity={0.7}
              >
                <View style={[styles.cloudDot, { backgroundColor: cloudStatus === 'connected' ? Colors.success : Colors.error }]} />
                <Text style={styles.cloudText}>
                  {cloudStatus === 'connected' ? '已连接' : cloudStatus === 'checking' ? '检测中…' : '未连接'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.syncBtn} onPress={onRefresh} activeOpacity={0.7}>
                <Text style={styles.syncBtnText}>🔄</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 大字日期 + 星期（CodeBuddy 版风格） */}
          <TouchableOpacity style={styles.dateHero} onPress={() => setShowCalendar(true)} activeOpacity={0.7}>
            <Text style={styles.dateWeekday}>{weekdayStr}</Text>
            <Text style={styles.dateHeroText}>{dateStr || '...'}</Text>
          </TouchableOpacity>

          {/* 翻页时钟 */}
          <FlipClock />

          {/* 搜索栏 */}
          <SearchBar onSearch={(t) => t.length >= 2 && console.log('search:', t)} />
        </View>

        {/* ===== 主内容区 ===== */}
        <View style={styles.mainContent}>
          {/* 骨架屏 / 打卡 */}
          {loading ? (
            <SkeletonLoader type="checkin" />
          ) : (
            <CheckinCard data={checkinData} colors={{ gold: colors.gold }} />
          )}

          {/* 板块网格 */}
          {loading ? (
            <SkeletonLoader type="modules" count={6} />
          ) : (
            <View style={styles.moduleGrid}>
              {moduleKeys.map((key) => {
                const meta = MODULE_META[key];
                const prog = moduleProgress[key];
                const target = moduleTargets[key] || 0;
                const done = prog.done;
                const showTotal = target > 0 ? target : (prog.total > 0 ? prog.total : 0);
                const pct = showTotal > 0 ? Math.round((done / showTotal) * 100) : 0;
                const isComplete = showTotal > 0 && done >= showTotal;
                const isExpanded = expandedModule === key;
                const subs = SUB_SECTIONS[key] ?? [];
                const modColor = ModuleColors[key] || Colors.primary;

                return (
                  <View key={key} style={[styles.moduleCardWrap, isExpanded && { width: '100%' }]}>
                    <TouchableOpacity
                      style={[
                        styles.moduleCard,
                        isComplete && styles.moduleCardDone,
                        isExpanded && styles.moduleCardExpanded,
                        { borderColor: isExpanded ? modColor : Colors.border },
                      ]}
                      activeOpacity={0.7}
                      onPress={() => handleModulePress(key)}
                    >
                      {/* 板块图标（彩色圆角方块，CodeBuddy 风格） */}
                      <View style={[styles.moduleIconBox, { backgroundColor: modColor }]}>
                        <Text style={styles.moduleIconText}>{meta.icon}</Text>
                      </View>
                      <Text style={styles.moduleLabel}>{meta.label}</Text>
                      <Text style={[styles.moduleProgress, isComplete && { color: Colors.success }]}>
                        {done}/{showTotal || '—'}
                      </Text>
                      {pct > 0 && (
                        <View style={styles.progressBarBg}>
                          <View style={[styles.progressBarFill, { width: `${pct}%`, backgroundColor: isComplete ? Colors.success : modColor }]} />
                        </View>
                      )}
                      {isComplete && <Text style={styles.doneMark}>✨</Text>}
                    </TouchableOpacity>

                    {/* 展开子任务（CodeBuddy 风格 sub-sections-panel） */}
                    {isExpanded && (
                      <View style={[styles.subSectionPanel, { borderColor: modColor + '30' }]}>
                        {subs.map((sub) => (
                          <TouchableOpacity
                            key={sub.id}
                            style={styles.subItem}
                            onPress={() => router.push(`/(tabs)/module/${key}`)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.subStatus}>○</Text>
                            <Text style={styles.subName}>{sub.name}</Text>
                            <Text style={styles.subArrow}>→</Text>
                          </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                          style={[styles.subEnterBtn, { backgroundColor: modColor + '15' }]}
                          onPress={() => router.push(`/(tabs)/module/${key}`)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.subEnterText, { color: modColor }]}>进入详情页 ›</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* 弹窗 */}
      <CalendarModal visible={showCalendar} onClose={() => setShowCalendar(false)} />
      <WeatherForecastModal
        visible={showWeatherModal}
        city={weatherCity}
        forecast={weatherForecast}
        onChangeCity={handleWeatherCityChange}
        onClose={() => setShowWeatherModal(false)}
      />
    </View>
  );
}

// ===== 样式 =====

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: Spacing.xxl },

  /* ===== 渐变背景头部（CodeBuddy 版风格）===== */
  gradientHeader: {
    backgroundColor: Colors.gradientPrimaryStart,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
    // 底部渐变遮罩（用阴影模拟 CodeBuddy 版 box-shadow）
    shadowColor: 'rgba(46,111,126,0.3)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },

  /* 顶部栏 */
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  topLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  dateTextSmall: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  weatherTextSmall: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cloudBadge: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  cloudConnected: { backgroundColor: 'rgba(91,140,90,0.25)' },
  cloudDisconnected: { backgroundColor: 'rgba(255,255,255,0.12)' },
  cloudDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  cloudText: { fontSize: FontSize.xs, color: '#FFFFFF' },
  syncBtn: {
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
    borderRadius: BorderRadius.full, backgroundColor: 'rgba(255,255,255,0.18)',
  },
  syncBtnText: { fontSize: 14, color: '#FFFFFF' },

  /* 菜单按钮 */
  menuBtn: {
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm, backgroundColor: 'rgba(255,255,255,0.18)',
  },
  menuBtnText: { fontSize: 18, color: '#FFFFFF' },

  /* 大字日期 + 星期（CodeBuddy 版风格） */
  dateHero: {
    alignItems: 'center', marginBottom: Spacing.lg, paddingTop: Spacing.sm,
  },
  dateWeekday: {
    fontSize: FontSize.md, color: 'rgba(255,255,255,0.75)', fontWeight: '500',
    letterSpacing: 2, marginBottom: Spacing.xs,
  },
  dateHeroText: {
    fontSize: FontSize.dateLarge, color: '#FFFFFF', fontWeight: '600',
    letterSpacing: 1,
  },

  /* 搜索栏 */
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchIcon: { fontSize: 16, marginRight: Spacing.sm },
  searchInput: { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary },

  /* ===== 主内容区 ===== */
  mainContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },

  /* 打卡 */
  checkinCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, marginBottom: Spacing.xl,
    borderWidth: 1, borderColor: Colors.borderLight,
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  checkinLeft: { flex: 1 },
  checkinTitle: { fontSize: FontSize.md, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: Spacing.xs },
  checkinStats: { flexDirection: 'row', marginBottom: 2 },
  checkinStat: { fontSize: FontSize.sm, color: Colors.textSecondary },
  checkinStatGap: { marginLeft: Spacing.lg },
  checkinNum: { fontSize: FontSize.md, fontWeight: 'bold' },
  checkinHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: Spacing.xs },
  checkinBadge: {
    backgroundColor: Colors.background, borderRadius: BorderRadius.full,
    width: 48, height: 48, justifyContent: 'center', alignItems: 'center',
  },
  checkinBadgeDone: { backgroundColor: Colors.success + '20' },
  checkinIcon: { fontSize: 24 },

  /* 板块网格 */
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg },
  moduleCardWrap: { width: SCREEN_WIDTH > 768 ? '30%' : '46.5%' },
  moduleCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg, padding: Spacing.lg,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.borderLight,
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 140,
  },
  moduleCardExpanded: { borderWidth: 2, shadowOpacity: 0.5, shadowRadius: 12 },
  moduleCardDone: { backgroundColor: Colors.success + '08', borderColor: Colors.success + '30' },

  /* CodeBuddy 风格图标方块 */
  moduleIconBox: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  moduleIconText: { fontSize: 20 },

  moduleLabel: { fontSize: FontSize.base, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
  moduleProgress: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 6, fontWeight: '600' },
  progressBarBg: { width: '75%', height: 5, borderRadius: 3, backgroundColor: Colors.borderLight, overflow: 'hidden' },
  progressBarFill: { height: 5, borderRadius: 3 },
  doneMark: { position: 'absolute', top: 6, right: 8, fontSize: 12 },

  /* 子任务展开面板 */
  subSectionPanel: {
    marginTop: Spacing.sm, backgroundColor: Colors.backgroundWarm,
    borderRadius: BorderRadius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.borderLight,
  },
  subItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  subStatus: { fontSize: 14, marginRight: Spacing.sm, color: Colors.textMuted },
  subName: { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary },
  subArrow: { fontSize: 14, color: Colors.textMuted },
  subEnterBtn: {
    marginTop: Spacing.sm, alignItems: 'center', paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  subEnterText: { fontSize: FontSize.sm, fontWeight: '600' },
});
