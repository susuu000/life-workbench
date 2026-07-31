import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, FontSize, BorderRadius } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import type {
  NewsItem,
  AIFrontierItem,
  StockSectorInfo,
  BookMovieNew,
  ReadingType,
} from '@/lib/types';

/** 发现页 · 四大分栏：时事新闻 / AI 前沿 / 股市信息 / 书影上新 */

type DiscoverTab = 'news' | 'ai' | 'stocks' | 'bookmovie';

const TABS: { key: DiscoverTab; label: string }[] = [
  { key: 'news', label: '时事新闻' },
  { key: 'ai', label: 'AI 前沿' },
  { key: 'stocks', label: '股市信息' },
  { key: 'bookmovie', label: '书影上新' },
];

const NEWS_SOURCE_LABEL: Record<NewsItem['source'], string> = {
  xinhua: '新华网',
  renmin: '人民网',
  other: '其他',
};

const BOOKMOVIE_SOURCE_LABEL: Record<BookMovieNew['source'], string> = {
  douban: '豆瓣',
  letterboxd: 'Letterboxd',
  tmdb: 'TMDB',
};

/** 日期摘要：取 YYYY-MM-DD 部分 */
function fmtDate(s?: string): string {
  if (!s) return '';
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/** 涨跌幅着色：红涨绿跌（A 股惯例） */
function changeColor(pct: number): string {
  if (pct > 0) return Colors.error;   // 涨 → 红
  if (pct < 0) return Colors.success; // 跌 → 绿
  return Colors.textSecondary;
}

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<DiscoverTab>('news');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 顶部固定分栏标签栏 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabScroll}
        contentContainerStyle={styles.tabContent}
      >
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabChip, activeTab === t.key && styles.tabChipActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[styles.tabLabel, activeTab === t.key && styles.tabLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 内容区（按 Tab 切换，均支持下拉刷新） */}
      <View style={styles.content}>
        {activeTab === 'news' && <NewsSection />}
        {activeTab === 'ai' && <AISection />}
        {activeTab === 'stocks' && <StocksSection />}
        {activeTab === 'bookmovie' && <BookMovieSection />}
      </View>
    </View>
  );
}

/* ===================== 时事新闻 ===================== */
function NewsSection() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('news_cache')
        .select('*')
        .order('published_at', { ascending: false });
      if (!error && data) setItems(data as NewsItem[]);
    } catch (e) {
      console.error('news_cache load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const openUrl = (url?: string) => {
    if (url) Linking.openURL(url).catch((e) => console.error(e));
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
      }
    >
      <View style={styles.hintRow}>
        <Text style={styles.hintText}>📰 每日精选 15 条</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <Text style={styles.refreshBtnText}>🔄 刷新</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loading} color={Colors.primary} />
      ) : items.length === 0 ? (
        <Text style={styles.empty}>暂无新闻数据</Text>
      ) : (
        items.map((it) => (
          <TouchableOpacity
            key={it.id}
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => openUrl(it.url)}
          >
            <View style={styles.cardTop}>
              <Text style={styles.sourceTag}>{NEWS_SOURCE_LABEL[it.source]}</Text>
              <Text style={styles.cardDate}>{fmtDate(it.published_at)}</Text>
            </View>
            <Text style={styles.cardTitle}>{it.title}</Text>
            {it.summary ? <Text style={styles.cardSummary}>{it.summary}</Text> : null}
            <Text style={styles.cardLink}>阅读原文 ›</Text>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

/* ===================== AI 前沿 ===================== */
function AISection() {
  const [items, setItems] = useState<AIFrontierItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('ai_frontier_cache')
        .select('*')
        .order('published_at', { ascending: false });
      if (!error && data) setItems(data as AIFrontierItem[]);
    } catch (e) {
      console.error('ai_frontier_cache load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const openUrl = (url?: string) => {
    if (url) Linking.openURL(url).catch((e) => console.error(e));
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
      }
    >
      <View style={styles.hintRow}>
        <Text style={styles.hintText}>🤖 每日精选 8 条</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <Text style={styles.refreshBtnText}>🔄 刷新</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loading} color={Colors.primary} />
      ) : items.length === 0 ? (
        <Text style={styles.empty}>暂无 AI 前沿数据</Text>
      ) : (
        items.map((it) => (
          <TouchableOpacity
            key={it.id}
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => openUrl(it.url)}
          >
            <View style={styles.cardTop}>
              <Text style={styles.sourceTag}>{it.source || '未知来源'}</Text>
              <Text style={styles.cardDate}>{fmtDate(it.published_at)}</Text>
            </View>
            <Text style={styles.cardTitle}>{it.title}</Text>
            {it.summary ? <Text style={styles.cardSummary}>{it.summary}</Text> : null}
            <Text style={styles.cardLink}>阅读原文 ›</Text>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

/* ===================== 股市信息 ===================== */
function StocksSection() {
  const [items, setItems] = useState<StockSectorInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('stock_sector_info')
        .select('*')
        .order('change_pct', { ascending: false });
      if (!error && data) setItems(data as StockSectorInfo[]);
    } catch (e) {
      console.error('stock_sector_info load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
      }
    >
      <Text style={styles.hintText}>📈 行业板块行情（红涨绿跌）</Text>

      {loading ? (
        <ActivityIndicator style={styles.loading} color={Colors.primary} />
      ) : items.length === 0 ? (
        <Text style={styles.empty}>暂无股市数据</Text>
      ) : (
        <View style={styles.stockGrid}>
          {items.map((it) => (
            <View key={`${it.sector}-${it.data_date}`} style={styles.stockCard}>
              <Text style={styles.stockSector}>{it.sector}</Text>
              <Text style={[styles.stockPct, { color: changeColor(it.change_pct) }]}>
                {it.change_pct >= 0 ? '+' : ''}
                {it.change_pct.toFixed(2)}%
              </Text>
              <Text style={styles.stockDate}>{fmtDate(it.data_date)}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

/* ===================== 书影上新 ===================== */
function BookMovieSection() {
  const [items, setItems] = useState<BookMovieNew[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('book_movie_new')
        .select('*')
        .order('published_at', { ascending: false });
      if (!error && data) setItems(data as BookMovieNew[]);
    } catch (e) {
      console.error('book_movie_new load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const openUrl = (url?: string) => {
    if (url) Linking.openURL(url).catch((e) => console.error(e));
  };

  const typeIcon = (t: ReadingType): string => (t === 'book' ? '📖' : '🎬');

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
      }
    >
      <Text style={styles.hintText}>📚 TMDB 同步上新（正在热映 / 即将上映）</Text>

      {loading ? (
        <ActivityIndicator style={styles.loading} color={Colors.primary} />
      ) : items.length === 0 ? (
        <Text style={styles.empty}>暂无书影上新</Text>
      ) : (
        items.map((it) => (
          <TouchableOpacity
            key={it.id}
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => openUrl(it.url)}
          >
            <View style={styles.cardTop}>
              <Text style={styles.typeIcon}>{typeIcon(it.type)}</Text>
              <Text style={styles.sourceTag}>{BOOKMOVIE_SOURCE_LABEL[it.source]}</Text>
            </View>
            <Text style={styles.cardTitle}>{it.title}</Text>
            {it.author ? <Text style={styles.cardSummary}>作者 / 导演：{it.author}</Text> : null}
            <Text style={styles.cardLink}>查看详情 ›</Text>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  tabScroll: {
    maxHeight: 52,
  },
  tabContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  tabChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tabLabel: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  tabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  hintText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  refreshBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  refreshBtnText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '500',
  },
  loading: {
    marginTop: Spacing.xxxl,
  },
  empty: {
    marginTop: Spacing.xxxl,
    textAlign: 'center',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  sourceTag: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.primary,
    backgroundColor: Colors.primary + '12',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  cardDate: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  cardTitle: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  cardSummary: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: Spacing.xs,
  },
  cardLink: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '500',
  },
  typeIcon: {
    fontSize: 20,
  },
  stockGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  stockCard: {
    width: '47%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  stockSector: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  stockPct: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  stockDate: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});
