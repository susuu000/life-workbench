/**
 * 阅读板块详情页 v3
 * 
 * 变更：
 * - 添加新条目时支持手动选择「书籍/影视」类型
 * - 类型切换带动对应的元数据字段（页数 vs 集数）
 * - 优化添加弹窗 UI（类型选择器 + 豆瓣自动匹配提示）
 * - 与 CodeBuddy 版主题配色统一
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, RefreshControl, Linking, Alert, Image, Modal, PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase, getCurrentUserId, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';
import { Colors, Spacing, FontSize, BorderRadius } from '@/lib/theme';
import { useDarkMode } from '@/lib/DarkModeProvider';
import { BookMovieEntry } from '@/lib/types';

// ===== 类型 =====
interface WechatPick {
  id: string;
  account: string;
  title: string;
  summary: string | null;
  url: string;
}
interface SanlianArticle {
  id: string;
  title: string;
  summary: string | null;
  url: string;
}

type ReadTab = 'bookmovie' | 'wechat' | 'sanlian';
type BookMovieFilter = 'reading' | 'planned';
type EntryType = 'book' | 'movie';

const WECHAT_ACCOUNTS: { key: string; label: string }[] = [
  { key: '单读', label: '单读' },
  { key: 'KnowYourself', label: 'KnowYourself' },
  { key: 'heytea', label: 'heytea 喜茶' },
];

const STATUS_LABEL: Record<BookMovieEntry['status'], string> = {
  reading: '在读/在看',
  planned: '计划读/计划看',
  completed: '读完/看完',
};

// ===== 主组件 =====

export default function ReadingDetailScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useDarkMode();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ReadTab>('bookmovie');

  const [entries, setEntries] = useState<BookMovieEntry[]>([]);
  const [bmFilter, setBmFilter] = useState<BookMovieFilter>('reading');

  const [wechat, setWechat] = useState<WechatPick[]>([]);
  const [wechatAccount, setWechatAccount] = useState<string>('单读');
  const [wechatCollected, setWechatCollected] = useState<Record<string, boolean>>({});

  const [sanlian, setSanlian] = useState<SanlianArticle[]>([]);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [checkinDates, setCheckinDates] = useState<Set<string>>(new Set());

  // 添加弹窗
  const [addModal, setAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<EntryType>('book');
  const [newAuthor, setNewAuthor] = useState('');
  const [newTotalPages, setNewTotalPages] = useState('');
  const [newTotalEpisodes, setNewTotalEpisodes] = useState('');
  const [adding, setAdding] = useState(false);

  const loadData = useCallback(async () => {
    const uid = await getCurrentUserId();

    if (uid) {
      const { data: ent } = await supabase
        .from('book_movie_entries')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });
      setEntries((ent as BookMovieEntry[]) ?? []);
    } else {
      setEntries([]);
    }

    const { data: wx } = await supabase
      .from('wechat_picks')
      .select('*')
      .order('week_of', { ascending: false });
    setWechat((wx as WechatPick[]) ?? []);

    const { data: sl } = await supabase
      .from('sanlian_articles')
      .select('*')
      .order('week_of', { ascending: false });
    setSanlian((sl as SanlianArticle[]) ?? []);

    if (uid) {
      const now = new Date();
      const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const { data: checkins } = await supabase
        .from('reading_checkins')
        .select('date')
        .eq('user_id', uid)
        .gte('date', startOfMonth);
      setCheckinDates(new Set((checkins ?? []).map((c: any) => c.date)));
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const openUrl = (url: string) => {
    Linking.canOpenURL(url).then(supported => {
      if (supported) Linking.openURL(url);
      else Alert.alert('无法打开', url);
    });
  };

  const updateProgress = async (entry: BookMovieEntry, value: number) => {
    const uid = await getCurrentUserId();
    if (!uid) return;
    const isBook = entry.type === 'book';
    const max = isBook ? entry.total_pages ?? 0 : entry.total_episodes ?? 0;
    const clamped = Math.max(0, Math.min(value, max));
    const field = isBook ? 'current_page' : 'current_episode';
    const patch: Record<string, unknown> = { [field]: clamped };
    if (max > 0 && clamped >= max) patch.status = 'completed';

    const { error } = await supabase
      .from('book_movie_entries')
      .update(patch)
      .eq('id', entry.id);
    if (!error) {
      setEntries(prev => prev.map(e =>
        e.id === entry.id
          ? { ...e, [field]: clamped, status: patch.status ? (patch.status as BookMovieEntry['status']) : e.status }
          : e
      ));
    } else {
      Alert.alert('更新失败', error.message);
    }
  };

  const checkin = async (entry: BookMovieEntry) => {
    const uid = await getCurrentUserId();
    if (!uid) { Alert.alert('提示', '请先登录后再打卡'); return; }
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase
      .from('reading_checkins')
      .insert({ user_id: uid, entry_id: entry.id, entry_type: entry.type, date: today });
    if (error) {
      if (error.code === '23505') {
        Alert.alert('提示', '今日已打卡');
      } else {
        Alert.alert('打卡失败', error.message);
      }
    } else {
      setCheckinDates(prev => new Set([...prev, today]));
      Alert.alert('打卡成功', `已在 ${today} 为《${entry.title}》打卡`);
    }
  };

  // ===== 添加新条目（支持手动选择类型）=====
  const addEntry = async () => {
    const uid = await getCurrentUserId();
    if (!uid) { Alert.alert('提示', '请先登录'); return; }
    const title = newTitle.trim();
    if (!title) { Alert.alert('提示', '请输入书名或影视名'); return; }

    setAdding(true);

    // 尝试豆瓣自动匹配
    let coverUrl = '';
    let author = newAuthor.trim();
    let description = '';
    let detectedType = newType;
    let totalPages = newTotalPages ? parseInt(newTotalPages) : undefined;
    let totalEpisodes = newTotalEpisodes ? parseInt(newTotalEpisodes) : undefined;

    try {
      const resp = await fetch(
        `${SUPABASE_URL}/functions/v1/douban-search?q=${encodeURIComponent(title)}`,
        { headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      if (resp.ok) {
        const json = await resp.json();
        if (json.data) {
          coverUrl = json.data.cover_url || '';
          if (!author) author = json.data.author || '';
          description = json.data.description || '';
          // 仅在未手动选择时使用豆瓣检测的类型
          if (json.data.type && !newType) {
            detectedType = json.data.type as EntryType;
          }
        }
      }
    } catch {
      // 豆瓣匹配失败静默
    }

    const { data, error } = await supabase
      .from('book_movie_entries')
      .insert({
        user_id: uid,
        type: detectedType,
        title,
        author,
        cover_url: coverUrl,
        description,
        status: 'reading',
        total_pages: detectedType === 'book' ? totalPages : null,
        total_episodes: detectedType === 'movie' ? totalEpisodes : null,
      })
      .select()
      .single();

    setAdding(false);

    if (error) {
      Alert.alert('添加失败', error.message);
      return;
    }
    setEntries(prev => [data as BookMovieEntry, ...prev]);
    // 重置表单
    setNewTitle('');
    setNewAuthor('');
    setNewTotalPages('');
    setNewTotalEpisodes('');
    setNewType('book');
    setAddModal(false);
  };

  const deleteEntry = (entry: BookMovieEntry) => {
    Alert.alert('确认删除', `确定要删除「${entry.title}」吗？此操作不可恢复。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('book_movie_entries').delete().eq('id', entry.id);
          if (!error) {
            setEntries(prev => prev.filter(e => e.id !== entry.id));
          } else {
            Alert.alert('删除失败', error.message);
          }
        },
      },
    ]);
  };

  const filteredEntries = entries.filter(e => e.status === bmFilter);
  const filteredWechat = wechat.filter(w => w.account === wechatAccount);

  const toggleWechatCollect = (id: string) => {
    setWechatCollected(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>📚 阅读</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh} activeOpacity={0.7}>
          <Text style={styles.refreshText}>{refreshing ? '刷新中…' : '↻ 刷新'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        <TabButton label="书影" active={activeTab === 'bookmovie'} onPress={() => setActiveTab('bookmovie')} />
        <TabButton label="公众号精选" active={activeTab === 'wechat'} onPress={() => setActiveTab('wechat')} />
        <TabButton label="三联中读" active={activeTab === 'sanlian'} onPress={() => setActiveTab('sanlian')} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
      >
        {activeTab === 'bookmovie' && (
          <BookMovieTab
            filter={bmFilter}
            setFilter={setBmFilter}
            entries={filteredEntries}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            checkinDates={checkinDates}
            onOpenUrl={openUrl}
            onProgress={updateProgress}
            onCheckin={checkin}
            onDelete={deleteEntry}
            onAddPress={() => setAddModal(true)}
          />
        )}

        {activeTab === 'wechat' && (
          <WechatTab
            accounts={WECHAT_ACCOUNTS}
            activeAccount={wechatAccount}
            setActiveAccount={setWechatAccount}
            items={filteredWechat}
            collected={wechatCollected}
            onToggleCollect={toggleWechatCollect}
            onOpenUrl={openUrl}
          />
        )}

        {activeTab === 'sanlian' && (
          <SanlianTab items={sanlian} onOpenUrl={openUrl} />
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ===== 添加弹窗（含类型选择器）===== */}
      <Modal visible={addModal} transparent animationType="slide" onRequestClose={() => setAddModal(false)}>
        <View style={styles.modalMask}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>添加新条目</Text>

            {/* 类型选择器 */}
            <Text style={styles.fieldLabel}>类型</Text>
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[styles.typeOption, newType === 'book' && styles.typeOptionActive]}
                onPress={() => setNewType('book')}
                activeOpacity={0.7}
              >
                <Text style={styles.typeIcon}>📖</Text>
                <Text style={[styles.typeLabel, newType === 'book' && styles.typeLabelActive]}>书籍</Text>
                {newType === 'book' && <Text style={styles.typeCheck}>✓</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeOption, newType === 'movie' && styles.typeOptionActive]}
                onPress={() => setNewType('movie')}
                activeOpacity={0.7}
              >
                <Text style={styles.typeIcon}>🎬</Text>
                <Text style={[styles.typeLabel, newType === 'movie' && styles.typeLabelActive]}>影视</Text>
                {newType === 'movie' && <Text style={styles.typeCheck}>✓</Text>}
              </TouchableOpacity>
            </View>

            {/* 名称 */}
            <Text style={styles.fieldLabel}>名称</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={newType === 'book' ? '输入书名…' : '输入影视名…'}
              placeholderTextColor={Colors.textMuted}
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
            />

            {/* 作者/导演 */}
            <Text style={styles.fieldLabel}>{newType === 'book' ? '作者' : '导演'}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={newType === 'book' ? '选填，豆瓣会自动匹配' : '选填，豆瓣会自动匹配'}
              placeholderTextColor={Colors.textMuted}
              value={newAuthor}
              onChangeText={setNewAuthor}
            />

            {/* 总页数 / 总集数 */}
            <Text style={styles.fieldLabel}>{newType === 'book' ? '总页数' : '总集数'}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={newType === 'book' ? '选填，用于进度追踪' : '选填，用于进度追踪'}
              placeholderTextColor={Colors.textMuted}
              value={newType === 'book' ? newTotalPages : newTotalEpisodes}
              onChangeText={newType === 'book' ? setNewTotalPages : setNewTotalEpisodes}
              keyboardType="numeric"
            />

            <Text style={styles.modalHint}>
              💡 豆瓣会自动匹配封面和简介，手动填写的信息优先使用
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => { setAddModal(false); setNewTitle(''); setNewAuthor(''); setNewTotalPages(''); setNewTotalEpisodes(''); }}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, (!newTitle.trim() || adding) && { opacity: 0.5 }]}
                onPress={addEntry}
                disabled={!newTitle.trim() || adding}
                activeOpacity={0.7}
              >
                <Text style={styles.modalConfirmText}>
                  {adding ? '添加中…' : '添加'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ===== 书影 Tab =====
function BookMovieTab({
  filter, setFilter, entries, expandedId, setExpandedId, checkinDates,
  onOpenUrl, onProgress, onCheckin, onDelete, onAddPress,
}: {
  filter: BookMovieFilter;
  setFilter: (f: BookMovieFilter) => void;
  entries: BookMovieEntry[];
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  checkinDates: Set<string>;
  onOpenUrl: (url: string) => void;
  onProgress: (entry: BookMovieEntry, value: number) => void;
  onCheckin: (entry: BookMovieEntry) => void;
  onDelete: (entry: BookMovieEntry) => void;
  onAddPress: () => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  return (
    <View>
      <View style={styles.subTabBar}>
        <SubTab label="在读/在看" active={filter === 'reading'} onPress={() => setFilter('reading')} />
        <SubTab label="计划读/计划看" active={filter === 'planned'} onPress={() => setFilter('planned')} />
        <TouchableOpacity style={styles.addBtn} onPress={onAddPress} activeOpacity={0.7}>
          <Text style={styles.addBtnText}>＋ 添加</Text>
        </TouchableOpacity>
      </View>

      <ReadingMonthCalendar marked={checkinDates} highlight={today} />

      {entries.length === 0 ? (
        <Text style={styles.empty}>暂无条目，点击右上角「＋ 添加」</Text>
      ) : (
        entries.map((entry) => {
          const isBook = entry.type === 'book';
          const max = isBook ? entry.total_pages ?? 0 : entry.total_episodes ?? 0;
          const cur = isBook ? entry.current_page ?? 0 : entry.current_episode ?? 0;
          const expanded = expandedId === entry.id;
          return (
            <View key={entry.id} style={styles.card}>
              <TouchableOpacity
                style={styles.bmHeader}
                onPress={() => setExpandedId(expanded ? null : entry.id)}
                activeOpacity={0.7}
              >
                {entry.cover_url ? (
                  <Image source={{ uri: entry.cover_url }} style={styles.bmCover} resizeMode="cover" />
                ) : (
                  <View style={[styles.bmCover, styles.bmCoverPlaceholder]}>
                    <Text style={styles.bmCoverEmoji}>{isBook ? '📖' : '🎬'}</Text>
                  </View>
                )}
                <View style={styles.bmInfo}>
                  <View style={styles.bmTitleRow}>
                    <Text style={styles.bmTitle} numberOfLines={2}>{entry.title}</Text>
                    <View style={[styles.typeBadge, isBook ? styles.typeBadgeBook : styles.typeBadgeMovie]}>
                      <Text style={styles.typeBadgeText}>{isBook ? '📖 书籍' : '🎬 影视'}</Text>
                    </View>
                  </View>
                  {entry.author && <Text style={styles.bmAuthor}>✍ {entry.author}</Text>}
                  <Text style={styles.bmProgress}>
                    {isBook ? `已读 ${cur} / ${max || '?'} 页` : `已看 ${cur} / ${max || '?'} 集`}
                  </Text>
                  <View style={styles.statusTag}>
                    <Text style={styles.statusTagText}>{STATUS_LABEL[entry.status]}</Text>
                  </View>
                </View>
                <Text style={styles.bmArrow}>{expanded ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {expanded && (
                <View style={styles.bmDetail}>
                  {entry.description ? (
                    <Text style={styles.bmDesc}>{entry.description}</Text>
                  ) : null}

                  {max > 0 ? (
                    <View style={styles.progressWrap}>
                      <Text style={styles.progressLabel}>进度调整（拖动滑块）</Text>
                      <ProgressSlider value={cur} max={max} onValueChange={(v) => onProgress(entry, v)} />
                      <Text style={styles.progressValue}>
                        {isBook ? `${cur} / ${max} 页` : `${cur} / ${max} 集`}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.progressHint}>暂无总{isBook ? '页数' : '集数'}，无法调整进度</Text>
                  )}

                  <View style={styles.bmDetailActions}>
                    <TouchableOpacity style={styles.checkinBtn} onPress={() => onCheckin(entry)} activeOpacity={0.7}>
                      <Text style={styles.checkinBtnText}>✓ 打卡</Text>
                    </TouchableOpacity>
                    {entry.recommendation_url && (
                      <TouchableOpacity style={styles.linkBtn} onPress={() => onOpenUrl(entry.recommendation_url!)} activeOpacity={0.7}>
                        <Text style={styles.linkBtnText}>🎬 B站解说</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.deleteEntryBtn} onPress={() => onDelete(entry)} activeOpacity={0.7}>
                      <Text style={styles.deleteEntryText}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

// ===== 公众号精选 Tab =====
function WechatTab({
  accounts, activeAccount, setActiveAccount, items, collected, onToggleCollect, onOpenUrl,
}: {
  accounts: { key: string; label: string }[];
  activeAccount: string;
  setActiveAccount: (a: string) => void;
  items: WechatPick[];
  collected: Record<string, boolean>;
  onToggleCollect: (id: string) => void;
  onOpenUrl: (url: string) => void;
}) {
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catBar}>
        {accounts.map(a => (
          <Chip key={a.key} label={a.label} active={activeAccount === a.key} onPress={() => setActiveAccount(a.key)} />
        ))}
      </ScrollView>
      {items.length === 0 ? (
        <Text style={styles.empty}>该账号暂无精选</Text>
      ) : (
        items.map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.wxTitle}>{item.title}</Text>
            {item.summary && <Text style={styles.wxSummary}>{item.summary}</Text>}
            <View style={styles.wxActions}>
              <TouchableOpacity style={styles.linkBtn} onPress={() => onOpenUrl(item.url)} activeOpacity={0.7}>
                <Text style={styles.linkBtnText}>🔗 阅读原文</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.collectBtn, collected[item.id] && styles.collectBtnOn]}
                onPress={() => onToggleCollect(item.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.collectBtnText, collected[item.id] && styles.collectBtnTextOn]}>
                  {collected[item.id] ? '★ 已收藏' : '☆ 收藏'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

// ===== 三联中读 Tab =====
function SanlianTab({ items, onOpenUrl }: { items: SanlianArticle[]; onOpenUrl: (url: string) => void }) {
  if (items.length === 0) return <Text style={styles.empty}>暂无三联中读文章</Text>;
  return (
    <View>
      {items.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.wxTitle}>{item.title}</Text>
          {item.summary && <Text style={styles.wxSummary}>{item.summary}</Text>}
          <TouchableOpacity style={styles.linkBtn} onPress={() => onOpenUrl(item.url)} activeOpacity={0.7}>
            <Text style={styles.linkBtnText}>🔗 阅读原文</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

// ===== 进度滑块 =====
function ProgressSlider({ value, max, onValueChange }: { value: number; max: number; onValueChange: (v: number) => void }) {
  const [width, setWidth] = useState(0);
  const update = (x: number) => {
    if (width <= 0 || max <= 0) return;
    const ratio = Math.min(1, Math.max(0, x / width));
    onValueChange(Math.round(ratio * max));
  };
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => update(e.nativeEvent.locationX),
      onPanResponderMove: (e) => update(e.nativeEvent.locationX),
    })
  ).current;
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <View
      style={styles.sliderTrack}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      {...panResponder.panHandlers}
    >
      <View style={[styles.sliderFill, { width: `${ratio * 100}%` }]} />
      <View style={[styles.sliderThumb, { left: `${ratio * 100}%` }]} />
    </View>
  );
}

// ===== 小组件 =====
function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.tabBtn, active && styles.tabBtnActive]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}
function SubTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.subTab, active && styles.subTabActive]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.subTabText, active && styles.subTabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}
function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ===== 月历打卡 =====
function ReadingMonthCalendar({ marked, highlight }: { marked: Set<string>; highlight: string }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return (
    <View style={styles.calWrap}>
      <Text style={styles.calTitle}>📅 {year} 年 {month + 1} 月 阅读打卡</Text>
      <View style={styles.calGrid}>
        {['日', '一', '二', '三', '四', '五', '六'].map(w => (
          <Text key={w} style={styles.calWeekday}>{w}</Text>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <View key={`e${i}`} style={styles.calCell} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const isMarked = marked.has(dateStr);
          const isToday = highlight === dateStr;
          return (
            <View key={dateStr} style={styles.calCell}>
              <View style={[styles.calDot, isMarked && styles.calDotMarked, isToday && styles.calDotToday]}>
                <Text style={[styles.calDay, isToday && styles.calDayToday]}>{d}</Text>
              </View>
            </View>
          );
        })}
      </View>
      <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm }}>
        本月已打卡 {marked.size} 天
      </Text>
    </View>
  );
}

// ===== 样式 =====
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  headerTitle: { fontSize: FontSize.xl, fontWeight: 'bold' },
  refreshBtn: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderWidth: 1, borderColor: Colors.border,
  },
  refreshText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },

  tabBar: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.sm },
  tabBtn: {
    flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabBtnText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  tabBtnTextActive: { color: '#FFFFFF' },

  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg },

  subTabBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  subTab: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
  },
  subTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  subTabText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  subTabTextActive: { color: '#FFFFFF' },
  addBtn: {
    marginLeft: 'auto', backgroundColor: Colors.gold, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
  },
  addBtnText: { fontSize: FontSize.sm, color: '#FFFFFF', fontWeight: 'bold' },

  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderLight,
    shadowColor: Colors.cardShadow, shadowOpacity: 1, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },

  bmHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  bmCover: { width: 56, height: 80, borderRadius: BorderRadius.sm, backgroundColor: Colors.border },
  bmCoverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  bmCoverEmoji: { fontSize: 28 },
  bmInfo: { flex: 1 },
  bmTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 2 },
  bmTitle: { fontSize: FontSize.base, fontWeight: 'bold', color: Colors.textPrimary, flex: 1 },
  typeBadge: {
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: BorderRadius.sm,
  },
  typeBadgeBook: { backgroundColor: Colors.primary + '18' },
  typeBadgeMovie: { backgroundColor: Colors.dianHong + '15' },
  typeBadgeText: { fontSize: 10, fontWeight: '600' },
  bmAuthor: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  bmProgress: { fontSize: FontSize.sm, color: Colors.primary, marginTop: Spacing.xs, fontWeight: '600' },
  statusTag: {
    alignSelf: 'flex-start', marginTop: Spacing.xs,
    backgroundColor: Colors.primaryLight + '22', borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  statusTagText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600' },
  bmArrow: { fontSize: 14, color: Colors.textMuted },

  bmDetail: { marginTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: Spacing.md },
  bmDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.md },
  progressWrap: { marginBottom: Spacing.md },
  progressLabel: { fontSize: FontSize.sm, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: Spacing.sm },
  progressValue: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: Spacing.xs, textAlign: 'center' },
  progressHint: { fontSize: FontSize.sm, color: Colors.textMuted, marginBottom: Spacing.md },
  sliderTrack: {
    height: 8, borderRadius: BorderRadius.full, backgroundColor: Colors.border,
    position: 'relative', justifyContent: 'center',
  },
  sliderFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: BorderRadius.full, backgroundColor: Colors.primary },
  sliderThumb: {
    position: 'absolute', width: 20, height: 20, borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary, borderWidth: 2, borderColor: '#FFFFFF', marginLeft: -10, top: -6,
  },
  bmDetailActions: { flexDirection: 'row', gap: Spacing.sm },
  checkinBtn: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.sm,
    backgroundColor: Colors.success, borderRadius: BorderRadius.full,
  },
  checkinBtnText: { color: '#FFFFFF', fontSize: FontSize.sm, fontWeight: '600' },
  linkBtn: {
    alignSelf: 'flex-start', marginTop: Spacing.md,
    backgroundColor: Colors.dianHong + '15', borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
  },
  linkBtnText: { fontSize: FontSize.sm, color: Colors.dianHong, fontWeight: '600' },
  catBar: { flexDirection: 'row', marginBottom: Spacing.md },
  chip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border, marginRight: Spacing.sm,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },
  wxTitle: { fontSize: FontSize.base, fontWeight: 'bold', color: Colors.textPrimary },
  wxSummary: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginTop: Spacing.xs },
  wxActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  collectBtn: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderWidth: 1, borderColor: Colors.border,
  },
  collectBtnOn: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  collectBtnText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  collectBtnTextOn: { color: '#FFFFFF' },
  empty: { textAlign: 'center', color: Colors.textMuted, fontSize: FontSize.sm, paddingVertical: Spacing.xl },

  /* 弹窗 */
  modalMask: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  modalBox: {
    width: '100%', maxWidth: 380, backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg, padding: Spacing.xl, borderWidth: 1, borderColor: Colors.border,
    maxHeight: '90%',
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: Spacing.lg, textAlign: 'center' },

  /* 类型选择器 */
  fieldLabel: {
    fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary,
    marginBottom: Spacing.xs, marginTop: Spacing.md,
  },
  typeSelector: {
    flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.sm,
  },
  typeOption: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md, borderWidth: 2, borderColor: Colors.borderLight,
    backgroundColor: Colors.background,
    gap: Spacing.sm,
  },
  typeOptionActive: {
    borderColor: Colors.primary, backgroundColor: Colors.primary + '10',
  },
  typeIcon: { fontSize: 20 },
  typeLabel: { fontSize: FontSize.base, fontWeight: '600', color: Colors.textSecondary },
  typeLabelActive: { color: Colors.primary },
  typeCheck: {
    position: 'absolute', top: 6, right: 8,
    fontSize: 14, color: Colors.primary, fontWeight: 'bold',
  },

  modalInput: {
    backgroundColor: Colors.background, borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: FontSize.base, color: Colors.textPrimary,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing.xs,
  },
  modalHint: {
    fontSize: FontSize.xs, color: Colors.textMuted, marginTop: Spacing.sm,
    lineHeight: 18,
  },
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
  modalCancel: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.border,
  },
  modalCancelText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
  modalConfirm: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary, borderRadius: BorderRadius.full,
  },
  modalConfirmText: { color: '#FFFFFF', fontSize: FontSize.sm, fontWeight: '600' },

  deleteEntryBtn: {
    width: 36, height: 36, borderRadius: BorderRadius.full,
    backgroundColor: Colors.error + '15', alignItems: 'center', justifyContent: 'center',
  },
  deleteEntryText: { fontSize: 16 },

  calWrap: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  calTitle: { fontSize: FontSize.sm, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: Spacing.sm, textAlign: 'center' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calWeekday: { width: '14.28%', textAlign: 'center', fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: Spacing.xs },
  calCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  calDot: {
    width: 28, height: 28, borderRadius: BorderRadius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  calDotMarked: { backgroundColor: Colors.success + '25' },
  calDotToday: { backgroundColor: Colors.primary },
  calDay: { fontSize: FontSize.xs, color: Colors.textPrimary },
  calDayToday: { color: '#FFFFFF', fontWeight: 'bold' },
});
