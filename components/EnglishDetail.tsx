/**
 * 英语板块详情页
 * 子模块：单词学习（墨墨跳转）+ 每日外刊听力（原文/音频/AI翻译）
 * 交互：单击完成/双击取消、完成项划线沉底、复盘输入行
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, RefreshControl, Linking, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { Colors, Spacing, FontSize, BorderRadius } from '@/lib/theme';

// ===== 类型 =====
interface TaskItem {
  id: string;
  title: string;
  sub_module: string;
  done: boolean;
  review_note: string;
  order_index: number;
}

interface WordTask {
  id: string;
  daily_target: number;
  completed: number;
  source_link: string | null;
  duolingo_done?: boolean;
}

interface ListeningArticle {
  id: string;
  title: string;
  audio_url: string;
  transcript: string | null;
  translation: string | null;
}

// ===== 主组件 =====

export default function EnglishDetailScreen() {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [wordTask, setWordTask] = useState<WordTask | null>(null);
  const [articles, setArticles] = useState<ListeningArticle[]>([]);
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  // ---- 数据加载 ----

  const loadData = useCallback(async () => {
    const uid = await getCurrentUserId();
    if (!uid) return;

    // 任务列表（英语板块）
    const { data: ts } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', uid)
      .eq('module', 'english')
      .order('done', { ascending: true })
      .order('order_index', { ascending: true });
    setTasks(ts ?? []);

    // 单词任务
    const today = new Date().toISOString().split('T')[0];
    const { data: wt } = await supabase
      .from('english_word_tasks')
      .select('*')
      .eq('user_id', uid)
      .eq('date', today)
      .maybeSingle();
    setWordTask(wt);

    // 外刊文章
    const { data: arts } = await supabase
      .from('listening_articles')
      .select('*')
      .order('date', { ascending: false })
      .limit(7);
    setArticles(arts ?? []);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ---- 交互：完成任务 ----

  const toggleTask = async (task: TaskItem) => {
    const uid = await getCurrentUserId();
    if (!uid) return;

    const newDone = !task.done;
    const { error } = await supabase
      .from('tasks')
      .update({ done: newDone, completed_at: newDone ? new Date().toISOString() : null })
      .eq('id', task.id);

    if (!error) {
      setTasks(prev => prev.map(t =>
        t.id === task.id ? { ...t, done: newDone } : t
      ));
    }
  };

  // ---- 保存复盘笔记 ----

  const saveReviewNote = async (taskId: string, note: string) => {
    const uid = await getCurrentUserId();
    if (!uid) return;

    const { error } = await supabase
      .from('tasks')
      .update({ review_note: note })
      .eq('id', taskId);

    if (!error) {
      setReviewNotes(prev => ({ ...prev, [taskId]: note }));
    }
  };

  // ---- 跳转墨墨背单词 ----

  const openMoMo = () => {
    // 墨墨背单词 URL Scheme
    const url = wordTask?.source_link ?? 'momo://';
    Linking.canOpenURL(url).then(supported => {
      if (supported) { Linking.openURL(url); }
      else {
        Alert.alert('提示', '请先安装墨墨背单词 App');
        // fallback: 打开 App Store
        Linking.openURL('https://apps.apple.com/app/墨墨背单词/id935734768');
      }
    });
  };

  // ---- 跳转多邻国 ----

  const openDuolingo = () => {
    // 多邻国 URL Scheme
    const schemes = ['duolingo://', 'https://www.duolingo.com/'];
    const tryOpen = async (url: string) => {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        return true;
      }
      return false;
    };
    (async () => {
      for (const scheme of schemes) {
        if (await tryOpen(scheme)) return;
      }
      Alert.alert('提示', '请先安装多邻国 App，或访问网页版 duolingo.com');
    })();
  };

  // ---- 渲染：排序（未完成在前，已完成沉底）----
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return a.order_index - b.order_index;
  });

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
    >
      {/* ===== 单词学习 ===== */}
      <SectionTitle icon="📖" title="单词学习" />
      <View style={styles.wordCard}>
        <View style={styles.wordInfo}>
          <Text style={styles.wordLabel}>今日目标</Text>
          <Text style={styles.wordTarget}>
            {wordTask?.completed ?? 0} / {wordTask?.daily_target ?? 15} 个
          </Text>
        </View>
        <TouchableOpacity style={styles.momoBtn} onPress={openMoMo} activeOpacity={0.7}>
          <Text style={styles.momoBtnText}>打开墨墨背单词 →</Text>
        </TouchableOpacity>
      </View>

      {/* ===== 多邻国打卡 ===== */}
      <SectionTitle icon="🦉" title="多邻国" />
      <View style={styles.wordCard}>
        <View style={styles.wordInfo}>
          <Text style={styles.wordLabel}>每日打卡</Text>
          <Text style={[styles.wordTarget, { color: Colors.success }]}>
            {wordTask?.duolingo_done ? '✓ 今日已打卡' : '○ 待打卡'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.momoBtn, { backgroundColor: Colors.success }]}
          onPress={async () => {
            const uid = await getCurrentUserId();
            if (!uid) { Alert.alert('提示', '请先登录'); return; }
            const today = new Date().toISOString().split('T')[0];
            // 更新或创建多邻国打卡记录
            const { error } = await supabase
              .from('english_word_tasks')
              .upsert({
                user_id: uid,
                date: today,
                duolingo_done: true,
                daily_target: wordTask?.daily_target ?? 15,
                completed: wordTask?.completed ?? 0,
              }, { onConflict: 'user_id,date' });
            if (!error) {
              setWordTask(prev => prev ? { ...prev, duolingo_done: true } : {
                id: '', user_id: uid, daily_target: 15, completed: 0, source_link: null, duolingo_done: true
              } as any);
              openDuolingo();
            } else {
              Alert.alert('打卡失败', error.message);
            }
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.momoBtnText}>
            {wordTask?.duolingo_done ? '已打卡 ✓' : '打卡并打开 →'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ===== 每日外刊听力 ===== */}
      <SectionTitle icon="🎧" title="每日外刊听力" />
      {articles.length > 0 ? articles.map((art) => (
        <View key={art.id} style={styles.articleCard}>
          <TouchableOpacity
            onPress={() => setExpandedArticle(expandedArticle === art.id ? null : art.id)}
            activeOpacity={0.7}
          >
            <View style={styles.articleHeader}>
              <Text style={styles.articleTitle}>{art.title}</Text>
              <Text style={styles.articleArrow}>
                {expandedArticle === art.id ? '▲' : '▼'}
              </Text>
            </View>
          </TouchableOpacity>

          {expandedArticle === art.id && (
            <View style={styles.articleBody}>
              {/* 原文 */}
              {art.transcript && (
                <>
                  <Text style={styles.bodyLabel}>📄 原文</Text>
                  <Text style={styles.bodyText}>{art.transcript}</Text>
                </>
              )}
              {/* AI 翻译 */}
              {art.translation && (
                <>
                  <Text style={styles.bodyLabel}>🌐 翻译</Text>
                  <Text style={styles.bodyText}>{art.translation}</Text>
                </>
              )}
              {/* 音频播放按钮 */}
              {art.audio_url && (
                <TouchableOpacity
                  style={styles.playBtn}
                  onPress={() => Linking.openURL(art.audio_url)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.playBtnText}>▶ 播放音频</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )) : (
        <Text style={styles.empty}>暂无外刊内容，将在每日更新后显示</Text>
      )}

      {/* ===== 任务列表（含复盘输入行）===== */}
      <SectionTitle icon="✅" title="今日任务" />
      {sortedTasks.map((task) => (
        <View key={task.id} style={[styles.taskRow, task.done && styles.taskDone]}>
          <TouchableOpacity
            style={styles.taskCheck}
            onPress={() => toggleTask(task)}
            onLongPress={() => toggleTask(task)} // 双击防误触：长按也切换
            activeOpacity={0.7}
          >
            <Text style={styles.taskCheckbox}>{task.done ? '☑' : '☐'}</Text>
          </TouchableOpacity>

          <View style={styles.taskContent}>
            <Text style={[styles.taskTitle, task.done && styles.taskTitleDone]}>
              {task.title}
            </Text>
            {task.sub_module && (
              <Text style={styles.taskSubModule}>{task.sub_module}</Text>
            )}

            {/* 复盘输入行 */}
            <TextInput
              style={styles.reviewInput}
              placeholder="写下今天的复盘…"
              placeholderTextColor={Colors.textMuted}
              defaultValue={task.review_note ?? reviewNotes[task.id] ?? ''}
              onChangeText={(text) => saveReviewNote(task.id, text)}
              editable={!task.done} // 完成后仍可编辑
            />
          </View>
        </View>
      ))}

      {sortedTasks.length === 0 && (
        <Text style={styles.empty}>暂无任务，可在设置中添加</Text>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ===== 子组件 =====

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <Text style={styles.sectionTitle}>{icon} {title}</Text>
  );
}

// ===== 样式 =====

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg },

  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },

  /* 单词卡片 */
  wordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  wordInfo: {},
  wordLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  wordTarget: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.gold, marginTop: Spacing.xs },
  momoBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  momoBtnText: { color: '#FFFFFF', fontSize: FontSize.sm, fontWeight: '600' },

  /* 外刊 */
  articleCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  articleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  articleTitle: { fontSize: FontSize.base, fontWeight: '600', color: Colors.textPrimary, flex: 1 },
  articleArrow: { fontSize: 14, color: Colors.textMuted },
  articleBody: { marginTop: Spacing.md, gap: Spacing.sm },
  bodyLabel: { fontSize: FontSize.sm, fontWeight: 'bold', color: Colors.primary, marginTop: Spacing.sm },
  bodyText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  playBtn: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.dianHong + '15',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginTop: Spacing.sm,
  },
  playBtnText: { fontSize: FontSize.sm, color: Colors.dianHong, fontWeight: '600' },

  /* 任务列表 */
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  taskDone: { opacity: 0.55, backgroundColor: '#F5F5F0' },
  taskCheck: { marginRight: Spacing.md, paddingTop: 2 },
  taskCheckbox: { fontSize: 22 },
  taskContent: { flex: 1 },
  taskTitle: { fontSize: FontSize.base, color: Colors.textPrimary },
  taskTitleDone: { textDecorationLine: 'line-through', color: Colors.textMuted },
  taskSubModule: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  reviewInput: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  empty: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    paddingVertical: Spacing.lg,
  },
});
