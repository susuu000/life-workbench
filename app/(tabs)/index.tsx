import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase, getCurrentUserId, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';
import { ensureDailyRefresh } from '@/lib/refresh';
import { Colors, Spacing, FontSize, BorderRadius, TimeFontFamily } from '@/lib/theme';
import { MODULE_META, type ModuleKey } from '@/lib/types';

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
        // TODO: 接入全文检索（跨表 ILIKE 查询）
      />
    </View>
  );
}

/** 时间卡片 */
function TimeCard() {
  const [timeStr, setTimeStr] = useState('');
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTimeStr(`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={styles.timeCard}>
      <Text
        style={[
          styles.timeText,
          Platform.OS === 'web' && { fontFamily: TimeFontFamily.web },
          Platform.OS === 'ios' && { fontFamily: TimeFontFamily.ios },
        ]}
      >
        {timeStr}
      </Text>
    </View>
  );
}

/** 打卡卡片（真实数据） */
function CheckinCard({ data }: { data: CheckinData | null }) {
  // 数据未加载时显示占位
  const display = data ?? { streakDays: 0, totalDays: 0, todayChecked: false };

  return (
    <View style={styles.checkinCard}>
      <View style={styles.checkinLeft}>
        <Text style={styles.checkinTitle}>今日打卡</Text>
        <View style={styles.checkinStats}>
          <Text style={styles.checkinStat}>
            连续 <Text style={styles.checkinNum}>{display.streakDays}</Text> 天
          </Text>
          <Text style={[styles.checkinStat, styles.checkinStatGap]}>
            累计 <Text style={styles.checkinNum}>{display.totalDays}</Text> 天
          </Text>
        </View>
      </View>
      <View style={[styles.checkinBadge, display.todayChecked && styles.checkinBadgeDone]}>
        <Text style={styles.checkinBadgeText}>
          {display.todayChecked ? '✅ 已打卡' : '⬜ 未打卡'}
        </Text>
      </View>
    </View>
  );
}

/** 天气图标映射（按文字描述粗匹配） */
function weatherEmoji(condition: string): string {
  if (/雨|雪|雷|雾|霾/.test(condition)) return '🌧️';
  if (/阴/.test(condition)) return '☁️';
  if (/多云|云/.test(condition)) return '⛅';
  if (/晴/.test(condition)) return '☀️';
  return '🌤️';
}

/** 天气组件：调用 get-weather Edge Function，城市取自 user_settings（默认宁波） */
function WeatherWidget() {
  const [city, setCity] = useState('宁波');
  const [temp, setTemp] = useState<number | null>(null);
  const [condition, setCondition] = useState('');
  const [icon, setIcon] = useState('☀️');

  useEffect(() => {
    let active = true;
    (async () => {
      const uid = await getCurrentUserId();
      let c = '宁波';
      if (uid) {
        const { data: s } = await supabase
          .from('user_settings')
          .select('weather_city')
          .eq('user_id', uid)
          .maybeSingle();
        c = s?.weather_city || '宁波';
        if (active) setCity(c);
      }
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/get-weather?city=${encodeURIComponent(c)}`,
        { headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      ).then((r) => r.json());
      if (res?.ok && res.data && active) {
        setTemp(res.data.temp);
        setCondition(res.data.condition);
        setIcon(weatherEmoji(res.data.condition));
      }
    })().catch(() => {
      /* 天气失败不阻断首页 */
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <TouchableOpacity style={styles.weatherWidget} activeOpacity={0.7}>
      <Text style={styles.weatherIcon}>{icon}</Text>
      <View>
        <Text style={styles.weatherCity}>{city}</Text>
        <Text style={styles.weatherTemp}>{temp != null ? `${temp}°C` : '—'}</Text>
      </View>
      <Text style={styles.weatherArrow}>›</Text>
    </TouchableOpacity>
  );
}

/** 单个板块卡片 */
interface ModuleCardProps {
  moduleKey: ModuleKey;
  progress: ModuleProgress;
  onPress: () => void;
  expanded?: boolean;
}

function ModuleCard({ moduleKey, progress, onPress, expanded }: ModuleCardProps) {
  const meta = MODULE_META[moduleKey];
  const isAllDone = progress.done >= progress.total && progress.total > 0;

  return (
    <TouchableOpacity
      style={[
        styles.moduleCard,
        isAllDone && styles.moduleCardDone,
        expanded && styles.moduleCardExpanded,
      ]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <Text style={styles.moduleIcon}>{meta.icon}</Text>
      <Text style={styles.moduleLabel}>{meta.label}</Text>
      <Text style={styles.moduleProgress}>{progress.done}/{progress.total}</Text>
      {isAllDone && <Text style={styles.doneMark}>✨</Text>}
    </TouchableOpacity>
  );
}

// ===== 首页主屏 =====

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [checkinData, setCheckinData] = useState<CheckinData | null>(null);
  const [moduleProgress, setModuleProgress] = useState<Record<ModuleKey, ModuleProgress>>({
    english:       { done: 0, total: 0 },
    ai_learning:   { done: 0, total: 0 },
    reading:       { done: 0, total: 0 },
    podcast:       { done: 0, total: 0 },
    social_media:  { done: 0, total: 0 },
    self_explore:  { done: 0, total: 0 },
  });
  const [expandedModule, setExpandedModule] = useState<ModuleKey | null>(null);

  /** 加载打卡数据 */
  const loadCheckin = useCallback(async () => {
    try {
      const uid = await getCurrentUserId();
      if (!uid) return;

      const today = new Date().toISOString().split('T')[0];

      // 今日是否已打卡
      const { data: todayCheck } = await supabase
        .from('checkin_records')
        .select('streak_days, total_days')
        .eq('user_id', uid)
        .eq('date', today)
        .maybeSingle();

      if (todayCheck) {
        setCheckinData({
          streakDays: todayCheck.streak_days,
          totalDays: todayCheck.total_days,
          todayChecked: true,
        });
      } else {
        // 获取历史累计（不含今天）
        const { count } = await supabase
          .from('checkin_records')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', uid);

        // 计算连续天数（从最新记录往前推）
        const { data: latest } = await supabase
          .from('checkin_records')
          .select('date')
          .eq('user_id', uid)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle();

        let streak = 0;
        if (latest) {
          streak = 1; // 最新一天算1天
          let prevDate = new Date(latest.date);
          // 往前查连续
          for (let i = 1; i < 365; i++) {
            prevDate.setDate(prevDate.getDate() - 1);
            const d = prevDate.toISOString().split('T')[0];
            const { data: rec } = await supabase
              .from('checkin_records')
              .select('id')
              .eq('user_id', uid)
              .eq('date', d)
              .maybeSingle();
            if (!rec) break;
            streak++;
          }
        }

        setCheckinData({
          streakDays: streak,
          totalDays: count ?? 0,
          todayChecked: false,
        });
      }
    } catch (e) {
      console.error('loadCheckin error:', e);
    }
  }, []);

  /** 加载各板块任务进度 */
  const loadProgress = useCallback(async () => {
    try {
      const uid = await getCurrentUserId();
      if (!uid) return;

      const { data: tasks } = await supabase
        .from('tasks')
        .select('module, done')
        .eq('user_id', uid);

      if (!tasks) return;

      const progress: Record<string, { done: number; total: number }> = {};
      for (const key of Object.keys(MODULE_META)) {
        progress[key] = { done: 0, total: 0 };
      }

      for (const t of tasks) {
        const m = t.module as string;
        if (progress[m]) {
          progress[m].total++;
          if (t.done) progress[m].done++;
        }
      }

      setModuleProgress(progress as Record<ModuleKey, ModuleProgress>);
    } catch (e) {
      console.error('loadProgress error:', e);
    }
  }, []);

  /** 下拉刷新 */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadCheckin(), loadProgress()]);
    setRefreshing(false);
  }, [loadCheckin, loadProgress]);

  /** 初始加载 */
  useEffect(() => {
    loadCheckin();
    loadProgress();
    // 打开 App 时若超过 24h 未自动刷新，则触发每日内容刷新（即发即忘）
    ensureDailyRefresh();
  }, [loadCheckin, loadProgress]);

  /** 板块点击：首次展开 → 二次跳转 */
  const handleModulePress = useCallback((key: ModuleKey) => {
    if (expandedModule === key) {
      // 二次点击 → 跳转到详情页
      router.push(`/(tabs)/module/${key}`);
    } else {
      // 首次点击 → 展开（标记展开状态）
      setExpandedModule(key);
      // TODO: 展开子模块浮层/列表
    }
  }, [expandedModule, router]);

  /** 全局搜索 */
  const handleSearch = useCallback((text: string) => {
    if (text.length < 2) return;
    // TODO: 跨表全文检索
    console.log('search:', text);
  }, []);

  const moduleKeys = Object.keys(MODULE_META) as ModuleKey[];

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
      }
    >
      {/* 搜索栏 */}
      <SearchBar onSearch={handleSearch} />

      {/* 第一行：时间卡片 */}
      <TimeCard />

      {/* 天气 */}
      <WeatherWidget />

      {/* 第二行：打卡卡片 */}
      <CheckinCard data={checkinData} />

      {/* 第三行：六大核心板块 */}
      <View style={styles.moduleGrid}>
        {moduleKeys.map((key) => (
          <ModuleCard
            key={key}
            moduleKey={key}
            progress={moduleProgress[key]}
            onPress={() => handleModulePress(key)}
            expanded={expandedModule === key}
          />
        ))}
      </View>

      {/* 底部留白 */}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ===== 样式 =====

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg },

  /* 搜索栏 */
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: { fontSize: 16, marginRight: Spacing.sm },
  searchInput: { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary },

  /* 时间卡片 */
  timeCard: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  timeText: {
    fontSize: FontSize.timeHuge,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 4,
  },

  /* 天气 */
  weatherWidget: {
    position: 'absolute',
    top: 8,
    left: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    gap: 4,
  },
  weatherIcon: { fontSize: 18 },
  weatherCity: { fontSize: FontSize.xs, color: Colors.textSecondary },
  weatherTemp: { fontSize: FontSize.sm, fontWeight: 'bold', color: Colors.textPrimary },
  weatherArrow: { fontSize: 16, color: Colors.textMuted },

  /* 打卡卡片 */
  checkinCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  checkinLeft: {},
  checkinTitle: { fontSize: FontSize.md, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: Spacing.xs },
  checkinStats: { flexDirection: 'row' },
  checkinStat: { fontSize: FontSize.sm, color: Colors.textSecondary },
  checkinStatGap: { marginLeft: Spacing.lg },
  checkinNum: { fontSize: FontSize.md, fontWeight: 'bold', color: Colors.gold },
  checkinBadge: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  checkinBadgeDone: { backgroundColor: Colors.success + '20' },
  checkinBadgeText: { fontSize: FontSize.sm, fontWeight: '600' },

  /* 板块网格 */
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  moduleCard: {
    width: '47%',
    aspectRatio: 1.15,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  moduleCardExpanded: { borderColor: Colors.primary, borderWidth: 2 },
  moduleCardDone: { backgroundColor: Colors.gold + '12', borderColor: Colors.gold },
  moduleIcon: { fontSize: 32, marginBottom: Spacing.sm },
  moduleLabel: { fontSize: FontSize.base, fontWeight: '600', color: Colors.textPrimary, marginBottom: Spacing.xs },
  moduleProgress: { fontSize: FontSize.sm, color: Colors.textSecondary },
  doneMark: { position: 'absolute', top: 8, right: 8, fontSize: 14 },
});
