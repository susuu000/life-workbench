/**
 * AI 学习板块详情页
 * 顶部分栏：AI 前沿资讯 / AI 思路·技巧·知识库
 * 秘色主题、卡片式布局，与英语板块风格一致
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, RefreshControl, Linking, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { Colors, Spacing, FontSize, BorderRadius } from '@/lib/theme';
import { AIInsight, AIKnowledgeItem } from '@/lib/types';

// ===== 知识库条目（在 lib 类型基础上补充 collected_by 数组用于收藏判定）=====
type KnowledgeItem = AIKnowledgeItem & {
  collectedBy: string[];
  content_type?: 'prompt' | 'tutorial';
  steps?: { step: number; title: string; detail: string }[];
};

type AITab = 'news' | 'knowledge';
type KnowledgeCategory = 'ai_office' | 'ai_comic' | 'ai_build' | 'ai_video';
type ContentTypeFilter = 'all' | 'prompt' | 'tutorial';

const KNOWLEDGE_CATEGORIES: { key: KnowledgeCategory; label: string }[] = [
  { key: 'ai_office', label: 'AI 办公' },
  { key: 'ai_comic', label: 'AI 漫剧' },
  { key: 'ai_build', label: 'AI 搭建' },
  { key: 'ai_video', label: 'AI 视频' },
];

const INSIGHT_TYPE_LABEL: Record<AIInsight['type'], string> = {
  news: '资讯',
  parse: '解析',
  video: '视频',
};

// ===== 主组件 =====

export default function AIDetailScreen() {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<AITab>('news');

  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<KnowledgeCategory | 'all'>('all');
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentTypeFilter>('all');
  const [mastered, setMastered] = useState<Record<string, boolean>>({});
  const [readingFeeling, setReadingFeeling] = useState('');
  const [savingFeeling, setSavingFeeling] = useState(false);

  const loadData = useCallback(async () => {
    const uid = await getCurrentUserId();

    const { data: ins } = await supabase
      .from('ai_insights')
      .select('*')
      .order('published_at', { ascending: false });
    setInsights((ins as AIInsight[]) ?? []);

    const { data: kno } = await supabase
      .from('ai_knowledge_items')
      .select('*')
      .order('created_at', { ascending: false });
    const mapped: KnowledgeItem[] = ((kno as any[]) ?? []).map((row) => ({
      id: row.id,
      category: row.category,
      prompt_formula: row.prompt_formula,
      four_elements: row.four_elements,
      summary: row.summary,
      core_tip: row.core_tip,
      content_type: row.content_type || 'prompt',
      steps: row.steps || [],
      collectedBy: Array.isArray(row.collected_by) ? row.collected_by : [],
      collected: Array.isArray(row.collected_by) && !!uid && row.collected_by.includes(uid),
    }));
    setKnowledge(mapped);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // ---- 阅读感受（保存至最新一条资讯，没有则提示）----
  const saveReadingFeeling = async () => {
    if (!readingFeeling.trim()) return;
    if (insights.length === 0) {
      Alert.alert('提示', '暂无可记录的资讯');
      return;
    }
    setSavingFeeling(true);
    const target = insights[0];
    const { error } = await supabase
      .from('ai_insights')
      .update({ reading_feeling: readingFeeling.trim() })
      .eq('id', target.id);
    setSavingFeeling(false);
    if (error) {
      Alert.alert('保存失败', error.message);
    } else {
      setInsights(prev => prev.map(i =>
        i.id === target.id ? { ...i, reading_feeling: readingFeeling.trim() } : i
      ));
    }
  };

  // ---- 收藏切换（写入 collected_by 数组）----
  const toggleCollect = async (item: KnowledgeItem) => {
    const uid = await getCurrentUserId();
    if (!uid) {
      Alert.alert('提示', '请先登录后再收藏');
      return;
    }
    const has = item.collectedBy.includes(uid);
    const newArr = has
      ? item.collectedBy.filter(id => id !== uid)
      : [...item.collectedBy, uid];
    const { error } = await supabase
      .from('ai_knowledge_items')
      .update({ collected_by: newArr })
      .eq('id', item.id);
    if (!error) {
      setKnowledge(prev => prev.map(k =>
        k.id === item.id ? { ...k, collectedBy: newArr, collected: !has } : k
      ));
    } else {
      Alert.alert('操作失败', error.message);
    }
  };

  const toggleMastered = (id: string) => {
    setMastered(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ---- 打开原文 ----
  const openUrl = (url?: string) => {
    if (!url) return;
    Linking.canOpenURL(url).then(supported => {
      if (supported) Linking.openURL(url);
      else Alert.alert('无法打开', url);
    });
  };

  const filteredKnowledge = (activeCategory === 'all'
    ? knowledge
    : knowledge.filter(k => k.category === activeCategory))
    .filter(k => contentTypeFilter === 'all' ? true : k.content_type === contentTypeFilter);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* 顶部标题 + 刷新 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🤖 AI 学习</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh} activeOpacity={0.7}>
          <Text style={styles.refreshText}>{refreshing ? '刷新中…' : '↻ 刷新'}</Text>
        </TouchableOpacity>
      </View>

      {/* 分栏切换 */}
      <View style={styles.tabBar}>
        <TabButton label="AI 前沿资讯" active={activeTab === 'news'} onPress={() => setActiveTab('news')} />
        <TabButton label="AI 知识库" active={activeTab === 'knowledge'} onPress={() => setActiveTab('knowledge')} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
      >
        {activeTab === 'news' ? (
          <NewsTab
            insights={insights}
            readingFeeling={readingFeeling}
            setReadingFeeling={setReadingFeeling}
            savingFeeling={savingFeeling}
            onSaveFeeling={saveReadingFeeling}
            onOpenUrl={openUrl}
          />
        ) : (
          <KnowledgeTab
            categories={KNOWLEDGE_CATEGORIES}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            contentTypeFilter={contentTypeFilter}
            setContentTypeFilter={setContentTypeFilter}
            items={filteredKnowledge}
            mastered={mastered}
            onToggleMastered={toggleMastered}
            onToggleCollect={toggleCollect}
          />
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ===== 资讯 Tab =====

function NewsTab({
  insights, readingFeeling, setReadingFeeling, savingFeeling, onSaveFeeling, onOpenUrl,
}: {
  insights: AIInsight[];
  readingFeeling: string;
  setReadingFeeling: (v: string) => void;
  savingFeeling: boolean;
  onSaveFeeling: () => void;
  onOpenUrl: (url?: string) => void;
}) {
  if (insights.length === 0) {
    return <Text style={styles.empty}>暂无资讯</Text>;
  }
  return (
    <View>
      {insights.map((item) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.newsHeader}>
            <Tag text={INSIGHT_TYPE_LABEL[item.type]} />
            <Text style={styles.newsContent}>{item.content}</Text>
          </View>

          <Field label="✨ 核心亮点" text={item.highlights} />
          <Field label="⚠️ 不足" text={item.shortcomings} />
          <Field label="💡 一句话价值" text={item.value_summary} />

          {item.source_url && (
            <TouchableOpacity style={styles.linkBtn} onPress={() => onOpenUrl(item.source_url)} activeOpacity={0.7}>
              <Text style={styles.linkBtnText}>🔗 阅读原文</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      {/* 阅读感受输入区 */}
      <View style={styles.feelingBox}>
        <Text style={styles.feelingLabel}>📝 阅读感受</Text>
        <TextInput
          style={styles.feelingInput}
          placeholder="写下你对这些资讯的感受…"
          placeholderTextColor={Colors.textMuted}
          value={readingFeeling}
          onChangeText={setReadingFeeling}
          multiline
          textAlignVertical="top"
        />
        <TouchableOpacity
          style={[styles.saveBtn, savingFeeling && styles.saveBtnDisabled]}
          onPress={onSaveFeeling}
          activeOpacity={0.7}
          disabled={savingFeeling}
        >
          <Text style={styles.saveBtnText}>{savingFeeling ? '保存中…' : '保存感受'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ===== 知识库 Tab =====

function KnowledgeTab({
  categories, activeCategory, setActiveCategory, contentTypeFilter, setContentTypeFilter,
  items, mastered, onToggleMastered, onToggleCollect,
}: {
  categories: { key: KnowledgeCategory; label: string }[];
  activeCategory: KnowledgeCategory | 'all';
  setActiveCategory: (c: KnowledgeCategory | 'all') => void;
  contentTypeFilter: ContentTypeFilter;
  setContentTypeFilter: (c: ContentTypeFilter) => void;
  items: KnowledgeItem[];
  mastered: Record<string, boolean>;
  onToggleMastered: (id: string) => void;
  onToggleCollect: (item: KnowledgeItem) => void;
}) {
  return (
    <View>
      {/* 分类标签 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catBar}>
        <Chip label="全部" active={activeCategory === 'all'} onPress={() => setActiveCategory('all')} />
        {categories.map(c => (
          <Chip key={c.key} label={c.label} active={activeCategory === c.key} onPress={() => setActiveCategory(c.key)} />
        ))}
      </ScrollView>

      {/* 内容类型筛选 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catBar}>
        <Chip label="全部类型" active={contentTypeFilter === 'all'} onPress={() => setContentTypeFilter('all')} />
        <Chip label="📖 实操教程" active={contentTypeFilter === 'tutorial'} onPress={() => setContentTypeFilter('tutorial')} />
        <Chip label="💡 提示词" active={contentTypeFilter === 'prompt'} onPress={() => setContentTypeFilter('prompt')} />
      </ScrollView>

      {items.length === 0 ? (
        <Text style={styles.empty}>该分类下暂无内容</Text>
      ) : (
        items.map((item) => {
          const isMastered = !!mastered[item.id];
          const isTutorial = item.content_type === 'tutorial';
          return (
            <View key={item.id} style={styles.card}>
              {/* 类型标签 */}
              <View style={styles.cardTypeRow}>
                <View style={[styles.typeTag, isTutorial ? styles.typeTagTutorial : styles.typeTagPrompt]}>
                  <Text style={styles.typeTagText}>{isTutorial ? '📖 实操教程' : '💡 提示词'}</Text>
                </View>
              </View>

              {isTutorial ? (
                <>
                  <Text style={styles.tutorialTitle}>{item.title || item.summary}</Text>
                  {item.summary && item.summary !== item.title && (
                    <Text style={styles.tutorialSummary}>{item.summary}</Text>
                  )}
                  {item.steps && item.steps.length > 0 && (
                    <View style={styles.stepsBox}>
                      {item.steps.map((s, i) => (
                        <View key={i} style={styles.stepRow}>
                          <View style={styles.stepNum}><Text style={styles.stepNumText}>{s.step}</Text></View>
                          <View style={styles.stepContent}>
                            <Text style={styles.stepTitle}>{s.title}</Text>
                            <Text style={styles.stepDetail}>{s.detail}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                  {item.core_tip ? (
                    <View style={styles.coreTipBox}>
                      <Text style={styles.coreTipLabel}>⭐ 核心技巧</Text>
                      <Text style={styles.coreTipText}>{item.core_tip}</Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <>
                  <Field label="🧩 万能提示词公式" text={item.prompt_formula} />
                  <Field label="🔢 四要素" text={item.four_elements} />
                  <Field label="📌 总结" text={item.summary} />
                  <Field label="⭐ 核心技巧" text={item.core_tip} />
                </>
              )}

              <View style={styles.knowledgeActions}>
                <TouchableOpacity
                  style={[styles.masterBtn, isMastered && styles.masterBtnOn]}
                  onPress={() => onToggleMastered(item.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.masterBtnText, isMastered && styles.masterBtnTextOn]}>
                    {isMastered ? '✓ 已掌握' : '标记掌握'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.collectBtn, item.collected && styles.collectBtnOn]}
                  onPress={() => onToggleCollect(item)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.collectBtnText, item.collected && styles.collectBtnTextOn]}>
                    {item.collected ? '★ 已收藏' : '☆ 收藏'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

// ===== 复用小组件 =====

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.tabBtn, active && styles.tabBtnActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Tag({ text }: { text: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{text}</Text>
    </View>
  );
}

function Field({ label, text }: { label: string; text: string }) {
  if (!text) return null;
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldText}>{text}</Text>
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
  headerTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.textPrimary },
  refreshBtn: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderWidth: 1, borderColor: Colors.border,
  },
  refreshText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },

  tabBar: {
    flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tabBtn: {
    flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabBtnText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  tabBtnTextActive: { color: '#FFFFFF' },

  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg },

  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: Colors.cardShadow, shadowOpacity: 1, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },

  newsHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.sm },
  newsContent: { flex: 1, fontSize: FontSize.md, fontWeight: 'bold', color: Colors.textPrimary },

  tag: {
    backgroundColor: Colors.primaryLight + '22', borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 2, alignSelf: 'flex-start',
  },
  tagText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600' },

  field: { marginTop: Spacing.sm },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: 'bold', color: Colors.primary, marginBottom: 2 },
  fieldText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  linkBtn: {
    alignSelf: 'flex-start', marginTop: Spacing.md,
    backgroundColor: Colors.dianHong + '15', borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
  },
  linkBtnText: { fontSize: FontSize.sm, color: Colors.dianHong, fontWeight: '600' },

  feelingBox: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, marginTop: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
  },
  feelingLabel: { fontSize: FontSize.base, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: Spacing.sm },
  feelingInput: {
    backgroundColor: Colors.background, borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm,
    fontSize: FontSize.sm, color: Colors.textSecondary,
    borderWidth: 1, borderColor: Colors.border, minHeight: 80,
  },
  saveBtn: {
    alignSelf: 'flex-end', marginTop: Spacing.md,
    backgroundColor: Colors.primary, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#FFFFFF', fontSize: FontSize.sm, fontWeight: '600' },

  catBar: { flexDirection: 'row', marginBottom: Spacing.md },
  chip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border, marginRight: Spacing.sm,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },

  knowledgeActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  masterBtn: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  masterBtnOn: { backgroundColor: Colors.success, borderColor: Colors.success },
  masterBtnText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  masterBtnTextOn: { color: '#FFFFFF' },

  collectBtn: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  collectBtnOn: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  collectBtnText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  collectBtnTextOn: { color: '#FFFFFF' },

  empty: {
    textAlign: 'center', color: Colors.textMuted,
    fontSize: FontSize.sm, paddingVertical: Spacing.xl,
  },

  /* 实操教程卡片 */
  cardTypeRow: { flexDirection: 'row', marginBottom: Spacing.sm },
  typeTag: {
    borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  typeTagTutorial: { backgroundColor: Colors.success + '20' },
  typeTagPrompt: { backgroundColor: Colors.primaryLight + '22' },
  typeTagText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textPrimary },
  tutorialTitle: { fontSize: FontSize.base, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: Spacing.xs },
  tutorialSummary: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.sm },
  stepsBox: {
    backgroundColor: Colors.background, borderRadius: BorderRadius.sm,
    padding: Spacing.md, marginTop: Spacing.xs,
  },
  stepRow: { flexDirection: 'row', marginBottom: Spacing.md },
  stepNum: {
    width: 24, height: 24, borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing.sm, marginTop: 2,
  },
  stepNumText: { color: '#FFFFFF', fontSize: FontSize.xs, fontWeight: 'bold' },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  stepDetail: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18, marginTop: 2 },
  coreTipBox: {
    backgroundColor: Colors.gold + '15', borderRadius: BorderRadius.sm,
    padding: Spacing.md, marginTop: Spacing.sm,
  },
  coreTipLabel: { fontSize: FontSize.xs, fontWeight: 'bold', color: Colors.gold },
  coreTipText: { fontSize: FontSize.sm, color: Colors.textPrimary, marginTop: Spacing.xs, lineHeight: 20 },
});
