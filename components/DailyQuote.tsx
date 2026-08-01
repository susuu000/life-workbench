/**
 * DailyQuote - 每日金句/名言组件
 * 
 * 功能：
 * - 首页展示每日一句名言
 * - 支持随机切换（同一日内可多次切换）
 * - 收藏喜欢的句子
 * - 内置中文名言库 + 可从 Supabase 加载更多
 * - 分享功能
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Share, Alert, Platform,
} from 'react-native';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { Colors, Spacing, FontSize, BorderRadius } from '@/lib/theme';

// ===== 类型 =====
interface Quote {
  id: string;
  text: string;
  author: string;
  source?: string;
  category?: string;
}

// ===== 内置名言库 =====
const BUILTIN_QUOTES: Quote[] = [
  { id: 'b1', text: '不积跬步，无以至千里；不积小流，无以成江海。', author: '荀子', source: '《劝学》' },
  { id: 'b2', text: '业精于勤，荒于嬉；行成于思，毁于随。', author: '韩愈', source: '《进学解》' },
  { id: 'b3', text: '天行健，君子以自强不息。', author: '《周易》' },
  { id: 'b4', text: '博学之，审问之，慎思之，明辨之，笃行之。', author: '《中庸》' },
  { id: 'b5', text: '盛年不重来，一日难再晨。及时当勉励，岁月不待人。', author: '陶渊明', source: '《杂诗》' },
  { id: 'b6', text: '学而不思则罔，思而不学则殆。', author: '孔子', source: '《论语》' },
  { id: 'b7', text: '知者不惑，仁者不忧，勇者不惧。', author: '孔子', source: '《论语》' },
  { id: 'b8', text: '非淡泊无以明志，非宁静无以致远。', author: '诸葛亮', source: '《诫子书》' },
  { id: 'b9', text: '路漫漫其修远兮，吾将上下而求索。', author: '屈原', source: '《离骚》' },
  { id: 'b10', text: '宝剑锋从磨砺出，梅花香自苦寒来。', author: '《警世贤文》' },
  { id: 'b11', text: '千里之行，始于足下。', author: '老子', source: '《道德经》' },
  { id: 'b12', text: '读书破万卷，下笔如有神。', author: '杜甫' },
  { id: 'b13', text: '纸上得来终觉浅，绝知此事要躬行。', author: '陆游' },
  { id: 'b14', text: '人生在勤，不索何获。', author: '张衡' },
  { id: 'b15', text: '志当存高远。', author: '诸葛亮' },
  { id: 'b16', text: '锲而不舍，金石可镂。', author: '荀子', source: '《劝学》' },
  { id: 'b17', text: '莫等闲，白了少年头，空悲切。', author: '岳飞', source: '《满江红》' },
  { id: 'b18', text: '三更灯火五更鸡，正是男儿读书时。', author: '颜真卿' },
  { id: 'b19', text: '问渠那得清如许，为有源头活水来。', author: '朱熹' },
  { id: 'b20', text: '山重水复疑无路，柳暗花明又一村。', author: '陆游' },
];

// 每日固定金句索引（基于日期）
function getDailyQuoteIndex(total: number): number {
  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
  );
  return dayOfYear % total;
}

// ===== 主组件 =====

interface DailyQuoteProps {
  onFavorite?: (quote: Quote) => void;
}

export default function DailyQuote({ onFavorite }: DailyQuoteProps) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [favorited, setFavorited] = useState(false);
  const [loading, setLoading] = useState(true);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  // 加载金句
  const loadQuote = useCallback(async (randomize = false) => {
    setLoading(true);

    // 淡出
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start();

    setTimeout(async () => {
      let selected: Quote;
      const allQuotes = [...BUILTIN_QUOTES];

      // 尝试从 Supabase 加载自定义名言
      try {
        const { data } = await supabase.from('daily_quotes').select('*').limit(50);
        if (data) {
          (data as Quote[]).forEach((q) => {
            if (!allQuotes.find((bq) => bq.text === q.text)) {
              allQuotes.push(q);
            }
          });
        }
      } catch {}

      if (randomize) {
        selected = allQuotes[Math.floor(Math.random() * allQuotes.length)];
      } else {
        selected = allQuotes[getDailyQuoteIndex(allQuotes.length)];
      }

      setQuote(selected);
      setFavorited(false);
      setLoading(false);

      // 淡入
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }, 200);
  }, []);

  useEffect(() => {
    loadQuote();
  }, [loadQuote]);

  // 收藏
  const handleFavorite = async () => {
    if (!quote) return;
    const uid = await getCurrentUserId();
    if (!uid) { Alert.alert('提示', '请先登录'); return; }

    if (favorited) {
      await supabase.from('favorite_quotes').delete().eq('user_id', uid).eq('quote_text', quote.text);
      setFavorited(false);
    } else {
      await supabase.from('favorite_quotes').insert({
        user_id: uid,
        quote_text: quote.text,
        author: quote.author,
        source: quote.source,
      });
      setFavorited(true);
      onFavorite?.(quote);
      Alert.alert('已收藏', '这句名言已加入你的收藏');
    }
  };

  // 分享
  const handleShare = async () => {
    if (!quote) return;
    const message = `「${quote.text}」—— ${quote.author}${quote.source ? ` ${quote.source}` : ''}\n\n——来自 月夕生活台`;
    try {
      await Share.share({ message, title: '每日金句' });
    } catch {}
  };

  if (!quote) return null;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* 装饰引号 */}
      <Text style={styles.quoteMark}>"</Text>

      {/* 名言文本 */}
      <Text style={styles.quoteText}>{quote.text}</Text>

      {/* 作者与出处 */}
      <View style={styles.authorRow}>
        <View style={styles.authorLine} />
        <Text style={styles.authorText}>
          —— {quote.author}
          {quote.source ? ` · ${quote.source}` : ''}
        </Text>
        <View style={styles.authorLine} />
      </View>

      {/* 操作按钮 */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => loadQuote(true)} activeOpacity={0.7}>
          <Text style={styles.actionBtnText}>🔄 换一句</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, favorited && styles.actionBtnFav]}
          onPress={handleFavorite}
          activeOpacity={0.7}
        >
          <Text style={[styles.actionBtnText, favorited && styles.actionBtnTextFav]}>
            {favorited ? '★ 已收藏' : '☆ 收藏'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleShare} activeOpacity={0.7}>
          <Text style={styles.actionBtnText}>📤 分享</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.gold + '30',
    alignItems: 'center',
    // 金色装饰边框
    borderLeftWidth: 3,
    borderLeftColor: Colors.gold,
  },
  quoteMark: {
    fontSize: 48,
    color: Colors.gold + '40',
    fontFamily: Platform.OS === 'ios' ? 'Times New Roman' : 'serif',
    lineHeight: 48,
    marginBottom: -10,
  },
  quoteText: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    lineHeight: 28,
    textAlign: 'center',
    fontWeight: '500',
    paddingHorizontal: Spacing.md,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  authorLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.borderLight,
  },
  authorText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  actionBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  actionBtnFav: {
    backgroundColor: Colors.gold + '20',
    borderColor: Colors.gold,
  },
  actionBtnText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  actionBtnTextFav: {
    color: Colors.gold,
  },
});
