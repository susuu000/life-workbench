import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase, getCurrentUserId, checkCloudConnection } from '@/lib/supabase';
import { Colors, Spacing, FontSize, BorderRadius } from '@/lib/theme';
import {
  MODULE_META,
  type ModuleKey,
  type Profile,
  type CollectionItem,
  type AIKnowledgeItem,
} from '@/lib/types';

/** 我的页 · 收藏归集 / 行为数据 / AI 学习专区 / 设置 */

/** 收藏分类（顺序即展示顺序） */
const COLLECTION_CATEGORIES = ['英语', 'AI学习', '阅读', '播客', '自媒体', '自我探索'] as const;
type CollectionCategory = (typeof COLLECTION_CATEGORIES)[number];

/** AI 知识库分类映射 */
const AI_CATEGORIES: { key: AIKnowledgeItem['category']; label: string }[] = [
  { key: 'ai_office', label: 'AI 办公' },
  { key: 'ai_comic', label: 'AI 漫剧' },
  { key: 'ai_build', label: 'AI 搭建' },
];

interface ModuleRate {
  module: ModuleKey;
  done: number;
  total: number;
}

function fmtDate(s?: string): string {
  if (!s) return '';
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/** 云端连接状态徽标（复用首页 checkCloudConnection 逻辑） */
function CloudStatusBadge() {
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'error' | 'checking'>(
    'checking'
  );

  const check = useCallback(async () => {
    setStatus('checking');
    const s = await checkCloudConnection();
    setStatus(s);
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const color =
    status === 'connected'
      ? Colors.success
      : status === 'disconnected'
        ? Colors.warning
        : status === 'error'
          ? Colors.error
          : Colors.textMuted;

  const label =
    status === 'connected'
      ? '云端已连接'
      : status === 'disconnected'
        ? '云端未连接'
        : status === 'error'
          ? '云端异常'
          : '连接检测中…';

  return (
    <TouchableOpacity style={styles.cloudBadge} onPress={check} activeOpacity={0.7}>
      <View style={[styles.cloudDot, { backgroundColor: color }]} />
      <Text style={styles.cloudText}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function MineScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  // 收藏归集
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [expandedCat, setExpandedCat] = useState<CollectionCategory | null>(null);

  // 行为数据
  const [weekCheckinDays, setWeekCheckinDays] = useState<number | null>(null);
  const [moduleRates, setModuleRates] = useState<ModuleRate[]>([]);

  // AI 学习专区
  const [aiItems, setAiItems] = useState<(AIKnowledgeItem & { collected_by?: string[] })[]>([]);
  const [aiFilter, setAiFilter] = useState<AIKnowledgeItem['category'] | 'all'>('all');

  // ===== 数据加载 =====
  const loadProfile = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();
    if (data) setProfile(data as Profile);
  }, []);

  const loadCollections = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .eq('user_id', uid)
      .order('collected_at', { ascending: false });
    if (!error && data) setCollections(data as CollectionItem[]);
  }, []);

  const loadBehavior = useCallback(async (uid: string) => {
    // 本周打卡天数（周一为起点）
    const now = new Date();
    const day = now.getDay(); // 0=周日
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    const weekStart = monday.toISOString().split('T')[0];

    const { count } = await supabase
      .from('checkin_records')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid)
      .gte('date', weekStart);
    setWeekCheckinDays(count ?? 0);

    // 各板块完成率
    const { data: tasks } = await supabase
      .from('tasks')
      .select('module, done')
      .eq('user_id', uid);

    const acc: Record<string, { done: number; total: number }> = {};
    for (const key of Object.keys(MODULE_META)) acc[key] = { done: 0, total: 0 };
    if (tasks) {
      for (const t of tasks) {
        const m = t.module as string;
        if (acc[m]) {
          acc[m].total += 1;
          if (t.done) acc[m].done += 1;
        }
      }
    }
    setModuleRates(
      (Object.keys(MODULE_META) as ModuleKey[]).map((m) => ({
        module: m,
        done: acc[m].done,
        total: acc[m].total,
      }))
    );
  }, []);

  const loadAiZone = useCallback(async (uid: string) => {
    const { data, error } = await supabase.from('ai_knowledge_items').select('*');
    if (!error && data) {
      const list = data as (AIKnowledgeItem & { collected_by?: string[] })[];
      // 仅保留当前用户收藏的条目
      const mine = list.filter(
        (it) => Array.isArray(it.collected_by) && it.collected_by.includes(uid)
      );
      setAiItems(mine);
    }
  }, []);

  const loadAll = useCallback(async () => {
    const uid = await getCurrentUserId();
    if (!uid) return;
    await Promise.all([
      loadProfile(uid),
      loadCollections(uid),
      loadBehavior(uid),
      loadAiZone(uid),
    ]);
  }, [loadProfile, loadCollections, loadBehavior, loadAiZone]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  // ===== 交互 =====
  const onEditProfile = () => {
    // TODO: 后续实现名称/头像编辑
    Alert.alert('编辑资料', '名称与头像修改功能开发中…');
  };

  const onRemoveCollection = (id: string) => {
    Alert.alert('取消收藏', '确定要移除这条收藏吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '移除',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('collections').delete().eq('id', id);
          if (!error) {
            setCollections((prev) => prev.filter((c) => c.id !== id));
          } else {
            Alert.alert('失败', '取消收藏出错，请重试');
          }
        },
      },
    ]);
  };

  const onOpenSettings = () => {
    router.push('/settings');
  };

  // 收藏按分类分组
  const grouped = COLLECTION_CATEGORIES.reduce<Record<string, CollectionItem[]>>((acc, c) => {
    acc[c] = collections.filter((it) => it.category === c);
    return acc;
  }, {});

  const filteredAi =
    aiFilter === 'all' ? aiItems : aiItems.filter((it) => it.category === aiFilter);

  const displayName = profile?.display_name || 'Susu';
  const avatarEmoji = profile?.avatar_url ? '🖼️' : '🌙';

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
      }
    >
      {/* 用户信息头部 */}
      <TouchableOpacity style={styles.profileHeader} onPress={onEditProfile} activeOpacity={0.7}>
        <View style={styles.avatar}>
          <Text style={styles.avatarEmoji}>{avatarEmoji}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileSub}>点击编辑名称与头像</Text>
        </View>
        <CloudStatusBadge />
      </TouchableOpacity>

      {/* 我的收藏归集 */}
      <SectionTitle title="📌 我的收藏" />
      {COLLECTION_CATEGORIES.map((cat) => {
        const list = grouped[cat] ?? [];
        const isOpen = expandedCat === cat;
        return (
          <View key={cat} style={styles.collectionBlock}>
            <TouchableOpacity
              style={styles.collectionRow}
              onPress={() => setExpandedCat(isOpen ? null : cat)}
              activeOpacity={0.7}
            >
              <Text style={styles.collectionLabel}>{cat}</Text>
              <Text style={styles.collectionCount}>{list.length} 条</Text>
              <Text style={styles.collectionArrow}>{isOpen ? '▾' : '›'}</Text>
            </TouchableOpacity>

            {isOpen &&
              (list.length === 0 ? (
                <Text style={styles.collectionEmpty}>暂无收藏</Text>
              ) : (
                list.map((it) => (
                  <View key={it.id} style={styles.collectionItem}>
                    <View style={styles.collectionItemInfo}>
                      <Text style={styles.collectionItemTitle}>
                        {cat}收藏 · 来自 {it.ref_table}
                      </Text>
                      <Text style={styles.collectionItemMeta}>{fmtDate(it.collected_at)}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => onRemoveCollection(it.id)}
                    >
                      <Text style={styles.cancelBtnText}>取消</Text>
                    </TouchableOpacity>
                  </View>
                ))
              ))}
          </View>
        );
      })}

      {/* 行为数据分析 */}
      <SectionTitle title="📊 行为数据分析" />
      <View style={styles.analysisCard}>
        <Text style={styles.analysisTitle}>本周学习概览</Text>
        <Text style={styles.analysisDesc}>
          本周打卡 {weekCheckinDays ?? '—'}/7 天
        </Text>
        <View style={styles.rateList}>
          {moduleRates.map((r) => {
            const pct = r.total > 0 ? Math.round((r.done / r.total) * 100) : 0;
            return (
              <View key={r.module} style={styles.rateRow}>
                <Text style={styles.rateLabel}>{MODULE_META[r.module].label}</Text>
                <View style={styles.rateBarBg}>
                  <View style={[styles.rateBarFill, { width: `${pct}%` }]} />
                </View>
                <Text style={styles.ratePct}>{pct}%</Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.analysisTip}>💡 建议：播客板块近 3 天未打开，可安排固定时段收听。</Text>
      </View>

      {/* AI 学习专区 */}
      <SectionTitle title="🤖 AI 学习专区" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.aiFilterScroll}
        contentContainerStyle={styles.aiFilterContent}
      >
        <TouchableOpacity
          style={[styles.aiFilterChip, aiFilter === 'all' && styles.aiFilterChipActive]}
          onPress={() => setAiFilter('all')}
        >
          <Text style={[styles.aiFilterLabel, aiFilter === 'all' && styles.aiFilterLabelActive]}>
            全部
          </Text>
        </TouchableOpacity>
        {AI_CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c.key}
            style={[styles.aiFilterChip, aiFilter === c.key && styles.aiFilterChipActive]}
            onPress={() => setAiFilter(c.key)}
          >
            <Text
              style={[styles.aiFilterLabel, aiFilter === c.key && styles.aiFilterLabelActive]}
            >
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filteredAi.length === 0 ? (
        <Text style={styles.empty}>暂无收藏的 AI 知识</Text>
      ) : (
        filteredAi.map((it) => (
          <View key={it.id} style={styles.aiItemCard}>
            <Text style={styles.aiItemTitle}>{it.summary || it.prompt_formula}</Text>
            <Text style={styles.aiItemMeta}>
              {AI_CATEGORIES.find((c) => c.key === it.category)?.label || it.category} · 已收藏 ✅
            </Text>
          </View>
        ))
      )}

      {/* 设置入口 */}
      <TouchableOpacity style={styles.settingsEntry} onPress={onOpenSettings} activeOpacity={0.7}>
        <Text style={styles.settingsLabel}>⚙️ 设置</Text>
        <Text style={styles.settingsArrow}>›</Text>
      </TouchableOpacity>

      {/* 底部留白 */}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },

  /* 用户信息 */
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  avatarEmoji: { fontSize: 28 },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  profileSub: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },

  /* 云端状态 */
  cloudBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cloudDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.xs,
  },
  cloudText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },

  /* 区块标题 */
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },

  /* 收藏分类 */
  collectionBlock: {
    marginBottom: Spacing.sm,
  },
  collectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  collectionLabel: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  collectionCount: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginRight: Spacing.sm,
  },
  collectionArrow: {
    fontSize: 16,
    color: Colors.textMuted,
  },
  collectionEmpty: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  collectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.xs,
    marginLeft: Spacing.md,
  },
  collectionItemInfo: {
    flex: 1,
  },
  collectionItemTitle: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  collectionItemMeta: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  cancelBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelBtnText: {
    fontSize: FontSize.xs,
    color: Colors.dianHong,
  },

  /* 数据分析 */
  analysisCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  analysisTitle: {
    fontSize: FontSize.base,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  analysisDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  rateList: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rateLabel: {
    width: 56,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  rateBarBg: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  rateBarFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  ratePct: {
    width: 36,
    textAlign: 'right',
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
  },
  analysisTip: {
    fontSize: FontSize.sm,
    color: Colors.dianHong,
  },

  /* AI 专区 */
  aiFilterScroll: {
    marginBottom: Spacing.sm,
  },
  aiFilterContent: {
    gap: Spacing.sm,
  },
  aiFilterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  aiFilterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  aiFilterLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  aiFilterLabelActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  aiItemCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  aiItemTitle: {
    fontSize: FontSize.base,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  aiItemMeta: {
    fontSize: FontSize.xs,
    color: Colors.success,
    marginTop: 2,
  },
  empty: {
    textAlign: 'center',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    paddingVertical: Spacing.lg,
  },

  /* 设置 */
  settingsEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    padding: Spacing.md,
    marginTop: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  settingsLabel: {
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  settingsArrow: {
    fontSize: 18,
    color: Colors.textMuted,
  },
});
