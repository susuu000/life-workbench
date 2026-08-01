/**
 * 播客板块详情页
 * 子模块：小宇宙热榜（podcast_items, source='xiaoyuzhou_hot'）+ 我的关注
 * 交互：热榜按周分组、播放跳转(Linking)、关注切换、添加播客
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, RefreshControl, Linking, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { Colors, Spacing, FontSize, BorderRadius } from '@/lib/theme';
import type { PodcastItem } from '@/lib/types';

// ===== 本地类型 =====
interface FollowPodcast {
  name: string;
  following: boolean;
  lastUpdate: string | null; // 最近更新日期 YYYY-MM-DD
}

type PodcastTab = 'hot' | 'follows';

// 预设默认关注播客
const DEFAULT_FOLLOWS: FollowPodcast[] = [
  { name: '随机波动', following: true, lastUpdate: null },
  { name: '日谈公园', following: true, lastUpdate: null },
  { name: '不合时宜', following: true, lastUpdate: null },
  { name: '文化有限', following: true, lastUpdate: null },
  { name: '纵横四海', following: true, lastUpdate: null },
];

// ===== 主组件 =====

export default function PodcastDetailScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<PodcastTab>('hot');
  const [refreshing, setRefreshing] = useState(false);

  const [hotItems, setHotItems] = useState<PodcastItem[]>([]);
  const [follows, setFollows] = useState<FollowPodcast[]>(DEFAULT_FOLLOWS);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');

  // ---- 数据加载 ----
  const loadData = useCallback(async () => {
    const uid = await getCurrentUserId();
    if (!uid) return;

    // 热榜
    const { data: hot } = await supabase
      .from('podcast_items')
      .select('*')
      .eq('source', 'xiaoyuzhou_hot')
      .order('week_of', { ascending: false });
    setHotItems(hot ?? []);

    // 我的关注的最近更新（取 source='my_follows' 最新一条）
    const { data: mine } = await supabase
      .from('podcast_items')
      .select('name, week_of')
      .eq('source', 'my_follows')
      .order('week_of', { ascending: false });

    setFollows(prev => prev.map(f => {
      const hit = mine?.find(m => m.name === f.name);
      return hit ? { ...f, lastUpdate: hit.week_of } : f;
    }));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ---- 播放跳转 ----
  const playEpisode = (url: string) => {
    if (!url) { Alert.alert('提示', '暂无播放链接'); return; }
    Linking.canOpenURL(url).then(supported => {
      if (supported) Linking.openURL(url);
      else Alert.alert('提示', '无法打开该链接');
    });
  };

  // ---- 关注切换 ----
  const toggleFollow = (name: string) => {
    setFollows(prev => prev.map(f =>
      f.name === name ? { ...f, following: !f.following } : f
    ));
  };

  // ---- 添加播客 ----
  const addPodcast = () => {
    const name = newName.trim();
    if (!name) { Alert.alert('提示', '请输入播客名称'); return; }
    setFollows(prev =>
      prev.some(f => f.name === name)
        ? prev
        : [...prev, { name, following: true, lastUpdate: null }]
    );
    setNewName('');
    setShowAdd(false);
  };

  // ---- 删除关注播客 ----
  const removeFollow = (name: string) => {
    Alert.alert('确认删除', `确定要移除「${name}」吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          setFollows(prev => prev.filter(f => f.name !== name));
        },
      },
    ]);
  };

  // ---- 删除热榜条目 ----
  const removeHotItem = async (item: PodcastItem) => {
    Alert.alert('确认删除', `确定要删除「${item.episode_title || item.name}」吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('podcast_items')
            .delete()
            .eq('id', item.id);
          if (!error) {
            setHotItems(prev => prev.filter(h => h.id !== item.id));
          } else {
            Alert.alert('删除失败', error.message);
          }
        },
      },
    ]);
  };

  // ---- 热榜按周分组 ----
  const groupedByWeek = hotItems.reduce<Record<string, PodcastItem[]>>((acc, item) => {
    const key = item.week_of || '未分组';
    (acc[key] ??= []).push(item);
    return acc;
  }, {});
  const weekKeys = Object.keys(groupedByWeek).sort((a, b) => (a < b ? 1 : -1));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ===== 顶部分栏 ===== */}
      <TabBar
        tabs={[
          { key: 'hot', label: '小宇宙热榜' },
          { key: 'follows', label: '我的关注' },
        ]}
        active={tab}
        onChange={(k) => setTab(k as PodcastTab)}
      />
      <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh} activeOpacity={0.7}>
        <Text style={styles.refreshText}>↻ 刷新</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {tab === 'hot' ? (
          weekKeys.length > 0 ? weekKeys.map(week => (
            <View key={week} style={styles.weekBlock}>
              <Text style={styles.weekTitle}>📅 第 {week} 周</Text>
              {groupedByWeek[week].map(item => (
                <View key={item.id} style={styles.hotCard}>
                  <View style={styles.hotCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.podcastName}>{item.name}</Text>
                      <Text style={styles.episodeTitle}>{item.episode_title}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => removeHotItem(item)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.deleteBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  {item.summary ? (
                    <Text style={styles.summary}>{item.summary}</Text>
                  ) : null}
                  <TouchableOpacity
                    style={styles.playBtn}
                    onPress={() => playEpisode(item.play_url)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.playBtnText}>▶ 播放</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )) : (
            <Text style={styles.empty}>暂无热榜数据，点击右上角刷新</Text>
          )
        ) : (
          <View>
            {follows.map(f => (
              <View key={f.name} style={styles.followCard}>
                <View style={styles.followInfo}>
                  <Text style={styles.followName}>{f.name}</Text>
                  {f.lastUpdate ? (
                    <Text style={styles.followUpdate}>最近更新：{f.lastUpdate}</Text>
                  ) : (
                    <Text style={styles.followUpdateMuted}>暂无更新</Text>
                  )}
                </View>
                <View style={styles.followActions}>
                  <TouchableOpacity
                    style={[styles.followBtn, !f.following && styles.followBtnOff]}
                    onPress={() => toggleFollow(f.name)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.followBtnText}>
                      {f.following ? '已关注' : '取消关注'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => removeFollow(f.name)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {showAdd ? (
              <View style={styles.addBox}>
                <TextInput
                  style={styles.addInput}
                  placeholder="输入播客名称"
                  placeholderTextColor={Colors.textMuted}
                  value={newName}
                  onChangeText={setNewName}
                  autoFocus
                />
                <TouchableOpacity style={styles.addConfirm} onPress={addPodcast} activeOpacity={0.7}>
                  <Text style={styles.addConfirmText}>添加</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)} activeOpacity={0.7}>
                <Text style={styles.addBtnText}>+ 添加播客</Text>
              </TouchableOpacity>
            )}
          </View>
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
  tabText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
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

  /* 热榜 */
  weekBlock: { marginBottom: Spacing.lg },
  weekTitle: { fontSize: FontSize.md, fontWeight: 'bold', color: Colors.primary, marginBottom: Spacing.sm },
  hotCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  podcastName: { fontSize: FontSize.base, fontWeight: 'bold', color: Colors.textPrimary },
  episodeTitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs },
  summary: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: Spacing.sm, lineHeight: 18 },
  playBtn: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.dianHong + '15',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginTop: Spacing.sm,
  },
  playBtnText: { fontSize: FontSize.xs, color: Colors.dianHong, fontWeight: '600' },

  /* 我的关注 */
  followCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  followInfo: { flex: 1 },
  followName: { fontSize: FontSize.base, fontWeight: '600', color: Colors.textPrimary },
  followUpdate: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: Spacing.xs },
  followUpdateMuted: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: Spacing.xs },
  followBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  followBtnOff: { backgroundColor: Colors.border },
  followBtnText: { fontSize: FontSize.xs, color: '#FFFFFF', fontWeight: '600' },
  followActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },

  /* 删除按钮 */
  deleteBtn: {
    width: 28, height: 28, borderRadius: BorderRadius.full,
    backgroundColor: Colors.error + '15', alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 14, color: Colors.error, fontWeight: 'bold' },
  hotCardHeader: { flexDirection: 'row', alignItems: 'flex-start' },

  /* 添加播客 */
  addBtn: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.primaryLight + '20',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  addBtnText: { fontSize: FontSize.base, color: Colors.primary, fontWeight: 'bold' },
  addBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  addInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addConfirm: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  addConfirmText: { color: '#FFFFFF', fontSize: FontSize.sm, fontWeight: '600' },

  empty: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    paddingVertical: Spacing.xl,
  },
});
