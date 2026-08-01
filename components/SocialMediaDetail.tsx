/**
 * 自媒体板块详情页
 * 子模块：今日推荐(today_rec) / 今日灵感(inspiration) / 审美搭建(aesthetic)
 * 交互：卡片展示、原链接跳转、收藏切换、大图布局、各 Tab 刷新
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Linking, Alert, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase, getCurrentUserId, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';
import { Colors, Spacing, FontSize, BorderRadius } from '@/lib/theme';
import type { SocialMediaRec } from '@/lib/types';

// ===== 本地类型 =====
type SocialTab = 'today' | 'inspiration' | 'aesthetic';

const PLATFORM_LABEL: Record<SocialMediaRec['platform'], string> = {
  xiaohongshu: '小红书',
  douyin: '抖音',
  other: '其他',
};

// ===== 主组件 =====

export default function SocialMediaDetailScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<SocialTab>('today');
  const [refreshing, setRefreshing] = useState(false);

  const [todayRecs, setTodayRecs] = useState<SocialMediaRec[]>([]);
  const [inspirations, setInspirations] = useState<SocialMediaRec[]>([]);
  const [aesthetics, setAesthetics] = useState<SocialMediaRec[]>([]);
  const [collectedIds, setCollectedIds] = useState<string[]>([]);

  // ---- 数据加载 ----
  const loadData = useCallback(async () => {
    const uid = await getCurrentUserId();

    const [todayRes, inspRes, aesRes, colRes] = await Promise.all([
      supabase.from('social_media_recs').select('*').eq('type', 'today_rec').order('published_at', { ascending: false }),
      supabase.from('social_media_recs').select('*').eq('type', 'inspiration').order('published_at', { ascending: true }).limit(10),
      supabase.from('social_media_recs').select('*').eq('type', 'aesthetic').order('published_at', { ascending: false }),
      uid
        ? supabase.from('collection_items').select('ref_id').eq('user_id', uid).eq('ref_table', 'social_media_recs')
        : Promise.resolve({ data: null as null, error: null }),
    ]);

    setTodayRecs(todayRes.data ?? []);
    setInspirations(inspRes.data ?? []);
    setAesthetics(aesRes.data ?? []);
    setCollectedIds((colRes.data ?? []).map((c: { ref_id: string }) => c.ref_id));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    // 触发云端内容刷新
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/daily-cron`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ triggered_by: 'social_media_refresh' }),
      });
    } catch { /* 忽略错误 */ }
    // 等待一小段时间让 Edge Function 写入数据
    await new Promise(r => setTimeout(r, 1500));
    await loadData();
    setRefreshing(false);
  };

  // ---- 原链接跳转 ----
  const openSource = (url?: string) => {
    if (!url) { Alert.alert('提示', '暂无原链接'); return; }
    Linking.canOpenURL(url).then(supported => {
      if (supported) Linking.openURL(url);
      else Alert.alert('提示', '无法打开该链接');
    });
  };

  // ---- 收藏切换 ----
  const toggleCollect = async (item: SocialMediaRec) => {
    const uid = await getCurrentUserId();
    if (!uid) { Alert.alert('提示', '请先登录'); return; }

    const isCollected = collectedIds.includes(item.id);
    if (isCollected) {
      await supabase.from('collection_items').delete().eq('user_id', uid).eq('ref_id', item.id);
      setCollectedIds(prev => prev.filter(id => id !== item.id));
    } else {
      await supabase.from('collection_items').insert({
        user_id: uid,
        category: 'social_media',
        ref_table: 'social_media_recs',
        ref_id: item.id,
      });
      setCollectedIds(prev => [...prev, item.id]);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ===== 顶部分栏 ===== */}
      <TabBar
        tabs={[
          { key: 'today', label: '今日推荐' },
          { key: 'inspiration', label: '今日灵感' },
          { key: 'aesthetic', label: '审美搭建' },
        ]}
        active={tab}
        onChange={(k) => setTab(k as SocialTab)}
      />
      <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh} activeOpacity={0.7}>
        <Text style={styles.refreshText}>↻ 刷新</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {tab === 'today' && (
          todayRecs.length > 0 ? todayRecs.map(item => (
            <View key={item.id} style={styles.recCard}>
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.recImage} resizeMode="cover" />
              ) : null}
              <Text style={styles.recTitle}>{item.title}</Text>
              {item.content ? <Text style={styles.recContent}>{item.content}</Text> : null}
              {item.traffic_analysis ? (
                <View style={styles.trafficBox}>
                  <Text style={styles.trafficLabel}>📈 流量逻辑</Text>
                  <Text style={styles.trafficText}>{item.traffic_analysis}</Text>
                </View>
              ) : null}
              <View style={styles.recFooter}>
                <View style={styles.platformTag}>
                  <Text style={styles.platformText}>{PLATFORM_LABEL[item.platform]}</Text>
                </View>
                <TouchableOpacity style={styles.sourceBtn} onPress={() => openSource(item.source_url)} activeOpacity={0.7}>
                  <Text style={styles.sourceText}>原链接 →</Text>
                </TouchableOpacity>
              </View>
            </View>
          )) : <Text style={styles.empty}>暂无今日推荐</Text>
        )}

        {tab === 'inspiration' && (
          inspirations.length > 0 ? inspirations.map((item, idx) => (
            <View key={item.id} style={styles.inspCard}>
              <View style={styles.inspHeader}>
                <Text style={styles.inspNo}>{idx + 1}</Text>
                <Text style={styles.inspTitle}>{item.title}</Text>
              </View>
              {item.content ? <Text style={styles.inspContent}>{item.content}</Text> : null}
              <TouchableOpacity
                style={[styles.collectBtn, collectedIds.includes(item.id) && styles.collectBtnOn]}
                onPress={() => toggleCollect(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.collectText}>
                  {collectedIds.includes(item.id) ? '★ 已收藏' : '☆ 收藏'}
                </Text>
              </TouchableOpacity>
            </View>
          )) : <Text style={styles.empty}>暂无灵感选题，点击刷新生成</Text>
        )}

        {tab === 'aesthetic' && (
          aesthetics.length > 0 ? aesthetics.map(item => (
            <View key={item.id} style={styles.aesCard}>
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.aesImage} resizeMode="cover" />
              ) : null}
              <View style={styles.aesFooter}>
                <Text style={styles.aesTitle}>{item.title}</Text>
                <View style={styles.platformTag}>
                  <Text style={styles.platformText}>{PLATFORM_LABEL[item.platform]}</Text>
                </View>
              </View>
              {item.source_url ? (
                <TouchableOpacity style={styles.aesLink} onPress={() => openSource(item.source_url)} activeOpacity={0.7}>
                  <Text style={styles.sourceText}>查看原文 →</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )) : <Text style={styles.empty}>暂无审美搭建内容</Text>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ===== 子组件：分栏 =====
function TabBar({
  tabs, active, onChange,
}: { tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void }) {
  return (
    <View style={styles.tabBar}>
      {tabs.map(t => (
        <TouchableOpacity
          key={t.key}
          style={[styles.tabItem, active === t.key && styles.tabActive]}
          onPress={() => onChange(t.key)}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, active === t.key && styles.tabTextActive]}>{t.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ===== 样式 =====
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    padding: Spacing.xs,
    margin: Spacing.lg,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabItem: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.full,
  },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: '#FFFFFF' },

  refreshBtn: {
    position: 'absolute',
    top: Spacing.lg + 14,
    right: Spacing.lg,
    zIndex: 10,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  refreshText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600' },

  /* 今日推荐 */
  recCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  recImage: { width: '100%', height: 160, borderRadius: BorderRadius.sm, marginBottom: Spacing.sm },
  recTitle: { fontSize: FontSize.md, fontWeight: 'bold', color: Colors.textPrimary },
  recContent: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs, lineHeight: 20 },
  trafficBox: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  trafficLabel: { fontSize: FontSize.xs, fontWeight: 'bold', color: Colors.primary },
  trafficText: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: Spacing.xs, lineHeight: 18 },
  recFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.sm },
  platformTag: {
    backgroundColor: Colors.gold + '20',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  platformText: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: '600' },
  sourceBtn: { paddingVertical: Spacing.xs },
  sourceText: { fontSize: FontSize.sm, color: Colors.dianHong, fontWeight: '600' },

  /* 今日灵感 */
  inspCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inspHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  inspNo: {
    width: 26, height: 26,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    color: '#FFFFFF',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    overflow: 'hidden',
  },
  inspTitle: { fontSize: FontSize.base, fontWeight: '600', color: Colors.textPrimary, flex: 1 },
  inspContent: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: Spacing.sm, lineHeight: 18 },
  collectBtn: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  collectBtnOn: { backgroundColor: Colors.gold + '20', borderColor: Colors.gold },
  collectText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '600' },

  /* 审美搭建 */
  aesCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  aesImage: { width: '100%', height: 200 },
  aesFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
  },
  aesTitle: { fontSize: FontSize.base, fontWeight: '600', color: Colors.textPrimary, flex: 1, marginRight: Spacing.sm },
  aesLink: {
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
  },

  empty: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    paddingVertical: Spacing.xl,
  },
});
