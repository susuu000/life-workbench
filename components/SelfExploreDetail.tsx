/**
 * 自我探索板块详情页
 * 子模块：今日状态 / 日常记录 / 新技能 / 生理期 / 财务 / 手账
 *
 * 说明：
 *  - 图片上传依赖 expo-image-picker，请先执行 `npx expo install expo-image-picker`
 *  - 手账多图上传至 Supabase Storage（bucket: journal）
 *  - 衣物链接 AI 识别、心情日历完整月视图等为占位/TODO，后续接入 DeepSeek
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, RefreshControl, Linking, Alert, Image, Switch, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// 注：expo-image-picker 需 `npx expo install expo-image-picker`
import * as ImagePicker from 'expo-image-picker';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { Colors, Spacing, FontSize, BorderRadius } from '@/lib/theme';
import type {
  MoodRecord, AppearanceRecord, ClothesRecord, DailyRecord,
  NewSkill, PeriodRecord, FinanceRecord, JournalEntry,
} from '@/lib/types';

// ===== 常量 =====
const MOOD_EMOJIS = ['😊', '😐', '😔', '😤', '🥰', '😴'];
const DAILY_PRESETS: { type: DailyRecord['type']; label: string }[] = [
  { type: 'outdoor', label: '出门玩 🎉' },
  { type: 'cooking', label: '做饭 🍳' },
  { type: 'cleaning', label: '打扫卫生 🧹' },
  { type: 'custom', label: '自定义 ✏️' },
];
const FINANCE_CATEGORIES = ['餐饮', '交通', '购物', '娱乐', '其他'];
const APPEARANCE_TYPES: { value: AppearanceRecord['type']; label: string }[] = [
  { value: 'ootd', label: 'OOTD' },
  { value: 'hairstyle', label: '发型' },
  { value: 'weight', label: '体重' },
];

type SelfTab = 'status' | 'daily' | 'skill' | 'period' | 'finance' | 'journal';

const TODAY = () => new Date().toISOString().split('T')[0];

// ===== 工具 =====
function daysBetween(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.round((db - da) / 86400000);
}

// ===== 主组件 =====

export default function SelfExploreDetailScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<SelfTab>('status');
  const [refreshing, setRefreshing] = useState(false);

  // 今日状态
  const [moods, setMoods] = useState<MoodRecord[]>([]);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [appearances, setAppearances] = useState<AppearanceRecord[]>([]);
  const [appType, setAppType] = useState<AppearanceRecord['type']>('ootd');
  const [appNote, setAppNote] = useState('');
  const [appImage, setAppImage] = useState<string | null>(null);
  const [clothes, setClothes] = useState<ClothesRecord[]>([]);
  const [clothLink, setClothLink] = useState('');

  // 日常记录
  const [dailies, setDailies] = useState<DailyRecord[]>([]);

  // 新技能
  const [skills, setSkills] = useState<NewSkill[]>([]);
  const [skillName, setSkillName] = useState('');
  const [skillDate, setSkillDate] = useState(TODAY());
  const [skillNote, setSkillNote] = useState('');

  // 生理期
  const [periods, setPeriods] = useState<PeriodRecord[]>([]);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [predictedNext, setPredictedNext] = useState<string | null>(null);

  // 财务
  const [finances, setFinances] = useState<FinanceRecord[]>([]);
  const [finAmount, setFinAmount] = useState('');
  const [finCategory, setFinCategory] = useState(FINANCE_CATEGORIES[0]);
  const [finNote, setFinNote] = useState('');
  const [finLarge, setFinLarge] = useState(false);

  // 手账
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [journalImages, setJournalImages] = useState<string[]>([]);
  const [journalText, setJournalText] = useState('');

  // ===== 编辑弹窗状态 =====
  const [editModal, setEditModal] = useState<{
    visible: boolean;
    type: 'skill' | 'finance' | 'cloth' | null;
    id: string;
    name?: string;
    date?: string;
    note?: string;
    amount?: string;
    category?: string;
    style?: string;
    price?: string;
  }>({ visible: false, type: null, id: '' });

  // ---- 数据加载 ----
  const loadData = useCallback(async () => {
    const uid = await getCurrentUserId();
    if (!uid) return;

    const today = TODAY();

    const [
      moodRes, appRes, clothRes, dailyRes, skillRes,
      periodRes, finRes, journalRes,
    ] = await Promise.all([
      supabase.from('mood_records').select('*').eq('user_id', uid),
      supabase.from('appearance_records').select('*').eq('user_id', uid).order('date', { ascending: false }),
      supabase.from('clothes_records').select('*').eq('user_id', uid),
      supabase.from('daily_records').select('*').eq('user_id', uid).eq('date', today),
      supabase.from('new_skills').select('*').eq('user_id', uid).order('learned_at', { ascending: false }),
      supabase.from('period_records').select('*').eq('user_id', uid).order('start_date', { ascending: false }),
      supabase.from('finance_records').select('*').eq('user_id', uid).order('recorded_at', { ascending: false }),
      supabase.from('journal_entries').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
    ]);

    setMoods(moodRes.data ?? []);
    setAppearances(appRes.data ?? []);
    setClothes(clothRes.data ?? []);
    setDailies(dailyRes.data ?? []);
    setSkills(skillRes.data ?? []);
    setPeriods(periodRes.data ?? []);
    setFinances(finRes.data ?? []);
    setJournals(journalRes.data ?? []);

    // 今日心情预选
    const todayMood = (moodRes.data ?? []).find(m => m.date === today);
    setSelectedMood(todayMood?.emotion ?? null);

    // 生理期预测：基于历史平均周期
    const ps = (periodRes.data ?? [])
      .map(p => p.start_date)
      .filter(Boolean)
      .sort((a, b) => (a < b ? 1 : -1));
    if (ps.length >= 2) {
      let total = 0;
      for (let i = 0; i < ps.length - 1; i++) total += daysBetween(ps[i + 1], ps[i]);
      const avg = Math.round(total / (ps.length - 1));
      const last = new Date(ps[0]);
      last.setDate(last.getDate() + avg);
      setPredictedNext(last.toISOString().split('T')[0]);
    } else {
      setPredictedNext(null);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ---- 图片选择 ----
  const pickImage = async (): Promise<string | null> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('提示', '需要相册权限才能选择图片');
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (result.canceled || result.assets.length === 0) return null;
    return result.assets[0].uri;
  };

  // ---- 上传到 Supabase Storage ----
  const uploadToStorage = async (uri: string): Promise<string | null> => {
    const uid = await getCurrentUserId();
    if (!uid) return null;
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const ext = uri.split('.').pop()?.split('?')[0] || 'jpg';
      const path = `${uid}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('journal')
        .upload(path, blob, { contentType: `image/${ext}`, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from('journal').getPublicUrl(path);
      return data.publicUrl;
    } catch (e) {
      Alert.alert('上传失败', String(e));
      return null;
    }
  };

  // ============ 今日状态：心情 ============
  const saveMood = async (emoji: string) => {
    const uid = await getCurrentUserId();
    if (!uid) return;
    const today = TODAY();
    setSelectedMood(emoji);
    const existing = moods.find(m => m.date === today);
    if (existing) {
      await supabase.from('mood_records').update({ emotion: emoji }).eq('id', existing.id);
    } else {
      const { data } = await supabase.from('mood_records').insert({ user_id: uid, date: today, emotion: emoji }).select().single();
      if (data) setMoods(prev => [...prev, data as MoodRecord]);
    }
  };

  // ============ 今日状态：外貌 ============
  const saveAppearance = async () => {
    const uid = await getCurrentUserId();
    if (!uid || !appImage) { Alert.alert('提示', '请先上传图片'); return; }
    const url = await uploadToStorage(appImage);
    if (!url) return;
    const { error } = await supabase.from('appearance_records').insert({
      user_id: uid, date: TODAY(), type: appType, image_url: url, note: appNote,
    });
    if (!error) {
      setAppImage(null); setAppNote('');
      await loadData();
    }
  };

  // ============ 今日状态：衣物 ============
  const recognizeClothes = async () => {
    const link = clothLink.trim();
    if (!link) { Alert.alert('提示', '请粘贴淘宝/小红书链接'); return; }
    // TODO: 后续接入 DeepSeek 识别样式/价格/分类
    Alert.alert('敬请期待', 'AI 识别（DeepSeek）即将上线，当前为占位数据');
    const placeholder: ClothesRecord = {
      id: `tmp_${Date.now()}`,
      user_id: (await getCurrentUserId()) ?? '',
      source_url: link,
      style: '待识别',
      price: 0,
      category: '待分类',
    };
    setClothes(prev => [...prev, placeholder]);
  };

  // ============ 日常记录 ============
  const toggleDaily = async (type: DailyRecord['type']) => {
    const uid = await getCurrentUserId();
    if (!uid) return;
    const today = TODAY();
    const existing = dailies.find(d => d.type === type);
    if (existing) {
      const newDone = !existing.done;
      await supabase.from('daily_records').update({ done: newDone }).eq('id', existing.id);
      setDailies(prev => prev.map(d => d.id === existing.id ? { ...d, done: newDone } : d));
    } else {
      const { data } = await supabase
        .from('daily_records')
        .insert({ user_id: uid, date: today, type, done: true })
        .select().single();
      if (data) setDailies(prev => [...prev, data as DailyRecord]);
    }
  };

  const cancelDaily = async (type: DailyRecord['type']) => {
    const existing = dailies.find(d => d.type === type);
    if (!existing || !existing.done) return;
    const uid = await getCurrentUserId();
    if (!uid) return;
    await supabase.from('daily_records').update({ done: false }).eq('id', existing.id);
    setDailies(prev => prev.map(d => d.id === existing.id ? { ...d, done: false } : d));
  };

  const addDailyPhoto = async (type: DailyRecord['type']) => {
    const uri = await pickImage();
    if (!uri) return;
    const uid = await getCurrentUserId();
    if (!uid) return;
    const today = TODAY();
    const url = await uploadToStorage(uri);
    if (!url) return;
    const existing = dailies.find(d => d.type === type);
    if (existing) {
      await supabase.from('daily_records').update({ photo_url: url }).eq('id', existing.id);
      setDailies(prev => prev.map(d => d.id === existing.id ? { ...d, photo_url: url } : d));
    } else {
      const { data } = await supabase
        .from('daily_records')
        .insert({ user_id: uid, date: today, type, done: false, photo_url: url })
        .select().single();
      if (data) setDailies(prev => [...prev, data as DailyRecord]);
    }
  };

  // ============ 新技能 ============
  const addSkill = async () => {
    const uid = await getCurrentUserId();
    if (!uid || !skillName.trim()) { Alert.alert('提示', '请输入技能名称'); return; }
    const { error } = await supabase.from('new_skills').insert({
      user_id: uid, skill_name: skillName.trim(), learned_at: skillDate, notes: skillNote,
    });
    if (!error) {
      setSkillName(''); setSkillNote(''); setSkillDate(TODAY());
      await loadData();
    }
  };

  // ============ 生理期 ============
  const savePeriod = async () => {
    const uid = await getCurrentUserId();
    if (!uid || !periodStart || !periodEnd) { Alert.alert('提示', '请填写开始与结束日期'); return; }
    const { error } = await supabase.from('period_records').insert({
      user_id: uid, start_date: periodStart, end_date: periodEnd,
    });
    if (!error) {
      setPeriodStart(''); setPeriodEnd('');
      await loadData();
    }
  };

  // ============ 财务 ============
  const addFinance = async () => {
    const uid = await getCurrentUserId();
    const amount = Number(finAmount);
    if (!uid || !finAmount || Number.isNaN(amount)) { Alert.alert('提示', '请输入有效金额'); return; }
    const { error } = await supabase.from('finance_records').insert({
      user_id: uid, amount, category: finCategory, note: finNote, is_large: finLarge, recorded_at: TODAY(),
    });
    if (!error) {
      setFinAmount(''); setFinNote(''); setFinLarge(false);
      await loadData();
    }
  };

  // 月度汇总
  const monthlySummary = finances.reduce<Record<string, number>>((acc, f) => {
    const month = f.recorded_at.slice(0, 7);
    acc[month] = (acc[month] ?? 0) + f.amount;
    return acc;
  }, {});
  const monthKeys = Object.keys(monthlySummary).sort((a, b) => (a < b ? 1 : -1));

  // ============ 手账 ============
  const addJournalImage = async () => {
    const uri = await pickImage();
    if (uri) setJournalImages(prev => [...prev, uri]);
  };

  const saveJournal = async () => {
    const uid = await getCurrentUserId();
    if (!uid) return;
    if (journalImages.length === 0 && !journalText.trim()) {
      Alert.alert('提示', '请上传图片或填写文字'); return;
    }
    const urls: string[] = [];
    for (const uri of journalImages) {
      const u = await uploadToStorage(uri);
      if (u) urls.push(u);
    }
    const { error } = await supabase.from('journal_entries').insert({
      user_id: uid, images: urls, text: journalText,
    });
    if (!error) {
      setJournalImages([]); setJournalText('');
      await loadData();
    }
  };

  // ============ 编辑保存 ============
  const saveEdit = async () => {
    const uid = await getCurrentUserId();
    if (!uid) return;
    const { type, id, name, date, note, amount, category, style, price } = editModal;

    try {
      if (type === 'skill') {
        await supabase.from('new_skills').update({
          skill_name: name, learned_at: date, notes: note,
        }).eq('id', id);
      } else if (type === 'finance') {
        await supabase.from('finance_records').update({
          amount: Number(amount), category, note,
        }).eq('id', id);
      } else if (type === 'cloth') {
        await supabase.from('clothes_records').update({
          style, price: Number(price),
        }).eq('id', id);
      }
      setEditModal({ visible: false, type: null, id: '' });
      await loadData();
    } catch (e) {
      Alert.alert('保存失败', String(e));
    }
  };

  // ============ 渲染：生理期日历标记 ============
  const periodDays = new Set<string>();
  periods.forEach(p => {
    const s = new Date(p.start_date).getTime();
    const e = new Date(p.end_date).getTime();
    for (let t = s; t <= e; t += 86400000) {
      periodDays.add(new Date(t).toISOString().split('T')[0]);
    }
  });

  // 今日状态心情日历标记
  const moodDays = new Set(moods.map(m => m.date));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ===== 顶部分栏 ===== */}
      <TabBar
        tabs={[
          { key: 'status', label: '今日状态' },
          { key: 'daily', label: '日常记录' },
          { key: 'skill', label: '新技能' },
          { key: 'period', label: '生理期' },
          { key: 'finance', label: '财务' },
          { key: 'journal', label: '手账' },
        ]}
        active={tab}
        onChange={(k) => setTab(k as SelfTab)}
      />
      <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh} activeOpacity={0.7}>
        <Text style={styles.refreshText}>↻ 刷新</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {tab === 'status' && (
          <View>
            {/* 情绪记录 */}
            <SectionTitle icon="💗" title="情绪记录" />
            <View style={styles.emojiRow}>
              {MOOD_EMOJIS.map(e => (
                <TouchableOpacity
                  key={e}
                  style={[styles.emojiBtn, selectedMood === e && styles.emojiBtnOn]}
                  onPress={() => saveMood(e)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.emojiText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.calendarEntry} onPress={() => Alert.alert('心情日历', '月视图（占位）')} activeOpacity={0.7}>
              <Text style={styles.calendarEntryText}>📅 查看心情日历</Text>
            </TouchableOpacity>
            <MonthCalendar marked={moodDays} highlight={TODAY()} color={Colors.primary} />

            {/* 外貌记录 */}
            <SectionTitle icon="📷" title="外貌记录" />
            <View style={styles.row}>
              {APPEARANCE_TYPES.map(t => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.chip, appType === t.value && styles.chipOn]}
                  onPress={() => setAppType(t.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, appType === t.value && styles.chipTextOn]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.uploadBtn} onPress={async () => setAppImage(await pickImage())} activeOpacity={0.7}>
              <Text style={styles.uploadBtnText}>{appImage ? '✓ 已选图片（点击重选）' : '+ 上传图片'}</Text>
            </TouchableOpacity>
            {appImage ? <Image source={{ uri: appImage }} style={styles.thumb} /> : null}
            <TextInput style={styles.input} placeholder="备注…" placeholderTextColor={Colors.textMuted} value={appNote} onChangeText={setAppNote} />
            <TouchableOpacity style={styles.primaryBtn} onPress={saveAppearance} activeOpacity={0.7}>
              <Text style={styles.primaryBtnText}>保存外貌记录</Text>
            </TouchableOpacity>

            {/* 衣物记录 */}
            <SectionTitle icon="👗" title="衣物记录" />
            <TextInput
              style={[styles.input, { marginBottom: Spacing.sm }]}
              placeholder="粘贴淘宝/小红书链接"
              placeholderTextColor={Colors.textMuted}
              value={clothLink}
              onChangeText={setClothLink}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={recognizeClothes} activeOpacity={0.7}>
              <Text style={styles.primaryBtnText}>AI 识别（TODO）</Text>
            </TouchableOpacity>
            {clothes.map(c => (
              <TouchableOpacity
                key={c.id}
                style={styles.clothCard}
                activeOpacity={0.7}
                onPress={() => setEditModal({
                  visible: true, type: 'cloth', id: c.id,
                  style: c.style, price: String(c.price),
                })}
              >
                <Text style={styles.clothStyle}>{c.style}</Text>
                <Text style={styles.clothMeta}>¥{c.price} · {c.category}</Text>
                {c.source_url ? (
                  <TouchableOpacity onPress={() => Linking.openURL(c.source_url)} activeOpacity={0.7}>
                    <Text style={styles.clothLink}>查看原链接 →</Text>
                  </TouchableOpacity>
                ) : null}
                <Text style={styles.editHint}>点击编辑</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {tab === 'daily' && (
          <View>
            <SectionTitle icon="📝" title="日常记录" />
            <Text style={styles.tip}>单击标记完成，长按/双击取消</Text>
            {DAILY_PRESETS.map(p => {
              const rec = dailies.find(d => d.type === p.type);
              const done = rec?.done ?? false;
              return (
                <View key={p.type} style={[styles.dailyCard, done && styles.dailyDone]}>
                  <TouchableOpacity
                    style={styles.dailyCheck}
                    onPress={() => toggleDaily(p.type)}
                    onLongPress={() => cancelDaily(p.type)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.dailyCheckbox}>{done ? '☑' : '☐'}</Text>
                  </TouchableOpacity>
                  <View style={styles.dailyContent}>
                    <Text style={[styles.dailyLabel, done && styles.dailyLabelDone]}>{p.label}</Text>
                    {rec?.photo_url ? (
                      <Image source={{ uri: rec.photo_url }} style={styles.thumbSm} />
                    ) : null}
                  </View>
                  <TouchableOpacity style={styles.dailyPhoto} onPress={() => addDailyPhoto(p.type)} activeOpacity={0.7}>
                    <Text style={styles.dailyPhotoText}>📷</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {tab === 'skill' && (
          <View>
            <SectionTitle icon="🌟" title="记录新技能" />
            <TextInput style={styles.input} placeholder="技能名称" placeholderTextColor={Colors.textMuted} value={skillName} onChangeText={setSkillName} />
            <TextInput style={styles.input} placeholder="学习日期 YYYY-MM-DD" placeholderTextColor={Colors.textMuted} value={skillDate} onChangeText={setSkillDate} autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="备注" placeholderTextColor={Colors.textMuted} value={skillNote} onChangeText={setSkillNote} />
            <TouchableOpacity style={styles.primaryBtn} onPress={addSkill} activeOpacity={0.7}>
              <Text style={styles.primaryBtnText}>+ 记录新技能</Text>
            </TouchableOpacity>
            <SectionTitle icon="📚" title="历史技能" />
            {skills.map(s => (
              <TouchableOpacity
                key={s.id}
                style={styles.listCard}
                activeOpacity={0.7}
                onPress={() => setEditModal({
                  visible: true, type: 'skill', id: s.id,
                  name: s.skill_name, date: s.learned_at, note: s.notes || '',
                })}
              >
                <Text style={styles.listTitle}>{s.skill_name}</Text>
                <Text style={styles.listMeta}>{s.learned_at}{s.notes ? ` · ${s.notes}` : ''}</Text>
                <Text style={styles.editHint}>点击编辑</Text>
              </TouchableOpacity>
            ))}
            {skills.length === 0 && <Text style={styles.empty}>暂无技能记录</Text>}
          </View>
        )}

        {tab === 'period' && (
          <View>
            <SectionTitle icon="🩸" title="生理期记录" />
            <TextInput style={styles.input} placeholder="开始日期 YYYY-MM-DD" placeholderTextColor={Colors.textMuted} value={periodStart} onChangeText={setPeriodStart} autoCapitalize="none" />
            <TextInput style={[styles.input, { marginBottom: Spacing.sm }]} placeholder="结束日期 YYYY-MM-DD" placeholderTextColor={Colors.textMuted} value={periodEnd} onChangeText={setPeriodEnd} autoCapitalize="none" />
            <TouchableOpacity style={styles.primaryBtn} onPress={savePeriod} activeOpacity={0.7}>
              <Text style={styles.primaryBtnText}>保存</Text>
            </TouchableOpacity>
            {predictedNext ? (
              <View style={styles.predictBox}>
                <Text style={styles.predictLabel}>🔮 预计下次来潮</Text>
                <Text style={styles.predictText}>{predictedNext}</Text>
              </View>
            ) : (
              <Text style={styles.tip}>记录至少两次后可自动预测</Text>
            )}
            <MonthCalendar marked={periodDays} highlight={predictedNext ?? undefined} color={Colors.dianHong} />
          </View>
        )}

        {tab === 'finance' && (
          <View>
            <SectionTitle icon="💰" title="记一笔" />
            <TextInput style={styles.input} placeholder="金额" placeholderTextColor={Colors.textMuted} value={finAmount} onChangeText={setFinAmount} keyboardType="numeric" />
            <View style={styles.row}>
              {FINANCE_CATEGORIES.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, finCategory === c && styles.chipOn]}
                  onPress={() => setFinCategory(c)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, finCategory === c && styles.chipTextOn]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={styles.input} placeholder="备注" placeholderTextColor={Colors.textMuted} value={finNote} onChangeText={setFinNote} />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>大额消费</Text>
              <Switch value={finLarge} onValueChange={setFinLarge} trackColor={{ true: Colors.primary }} />
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={addFinance} activeOpacity={0.7}>
              <Text style={styles.primaryBtnText}>保存</Text>
            </TouchableOpacity>

            <SectionTitle icon="📊" title="月度汇总" />
            {monthKeys.map(m => (
              <View key={m} style={styles.listCard}>
                <Text style={styles.listTitle}>{m}</Text>
                <Text style={styles.listMeta}>合计 ¥{monthlySummary[m].toFixed(2)}</Text>
              </View>
            ))}
            {monthKeys.length === 0 && <Text style={styles.empty}>暂无数据</Text>}

            <SectionTitle icon="🧾" title="历史记录" />
            {finances.map(f => (
              <TouchableOpacity
                key={f.id}
                style={styles.listCard}
                activeOpacity={0.7}
                onPress={() => setEditModal({
                  visible: true, type: 'finance', id: f.id,
                  amount: String(f.amount), category: f.category, note: f.note || '',
                })}
              >
                <View style={styles.finRow}>
                  <Text style={styles.listTitle}>¥{f.amount.toFixed(2)}</Text>
                  <Text style={styles.finCat}>{f.category}</Text>
                </View>
                <Text style={styles.listMeta}>{f.recorded_at}{f.note ? ` · ${f.note}` : ''}{f.is_large ? ' · 大额' : ''}</Text>
                <Text style={styles.editHint}>点击编辑</Text>
              </TouchableOpacity>
            ))}
            {finances.length === 0 && <Text style={styles.empty}>暂无记录</Text>}
          </View>
        )}

        {tab === 'journal' && (
          <View>
            <SectionTitle icon="📔" title="写手账" />
            <View style={styles.row}>
              {journalImages.map((uri, i) => (
                <Image key={i} source={{ uri }} style={styles.thumbGrid} />
              ))}
              <TouchableOpacity style={styles.journalAdd} onPress={addJournalImage} activeOpacity={0.7}>
                <Text style={styles.journalAddText}>+</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="文字备注…"
              placeholderTextColor={Colors.textMuted}
              value={journalText}
              onChangeText={setJournalText}
              multiline
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={saveJournal} activeOpacity={0.7}>
              <Text style={styles.primaryBtnText}>保存到手账</Text>
            </TouchableOpacity>

            <SectionTitle icon="🕰️" title="历史手账" />
            {journals.map(j => (
              <View key={j.id} style={styles.journalCard}>
                <View style={styles.journalImgs}>
                  {j.images.map((u, i) => (
                    <Image key={i} source={{ uri: u }} style={styles.thumbGrid} />
                  ))}
                </View>
                {j.text ? <Text style={styles.journalText}>{j.text}</Text> : null}
                <Text style={styles.listMeta}>{j.created_at.slice(0, 10)}</Text>
              </View>
            ))}
            {journals.length === 0 && <Text style={styles.empty}>暂无手账</Text>}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ===== 编辑弹窗 ===== */}
      <Modal visible={editModal.visible} transparent animationType="slide" onRequestClose={() => setEditModal({ visible: false, type: null, id: '' })}>
        <View style={styles.modalMask}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {editModal.type === 'skill' ? '编辑技能' : editModal.type === 'finance' ? '编辑财务记录' : '编辑衣物'}
            </Text>
            {editModal.type === 'skill' && (
              <>
                <TextInput style={styles.input} placeholder="技能名称" placeholderTextColor={Colors.textMuted}
                  value={editModal.name} onChangeText={(v) => setEditModal(prev => ({ ...prev, name: v }))} />
                <TextInput style={styles.input} placeholder="日期 YYYY-MM-DD" placeholderTextColor={Colors.textMuted}
                  value={editModal.date} onChangeText={(v) => setEditModal(prev => ({ ...prev, date: v }))} />
                <TextInput style={styles.input} placeholder="备注" placeholderTextColor={Colors.textMuted}
                  value={editModal.note} onChangeText={(v) => setEditModal(prev => ({ ...prev, note: v }))} />
              </>
            )}
            {editModal.type === 'finance' && (
              <>
                <TextInput style={styles.input} placeholder="金额" placeholderTextColor={Colors.textMuted} keyboardType="numeric"
                  value={editModal.amount} onChangeText={(v) => setEditModal(prev => ({ ...prev, amount: v }))} />
                <View style={styles.row}>
                  {FINANCE_CATEGORIES.map(c => (
                    <TouchableOpacity key={c}
                      style={[styles.chip, editModal.category === c && styles.chipOn]}
                      onPress={() => setEditModal(prev => ({ ...prev, category: c }))} activeOpacity={0.7}>
                      <Text style={[styles.chipText, editModal.category === c && styles.chipTextOn]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput style={styles.input} placeholder="备注" placeholderTextColor={Colors.textMuted}
                  value={editModal.note} onChangeText={(v) => setEditModal(prev => ({ ...prev, note: v }))} />
              </>
            )}
            {editModal.type === 'cloth' && (
              <>
                <TextInput style={styles.input} placeholder="风格/样式" placeholderTextColor={Colors.textMuted}
                  value={editModal.style} onChangeText={(v) => setEditModal(prev => ({ ...prev, style: v }))} />
                <TextInput style={styles.input} placeholder="价格" placeholderTextColor={Colors.textMuted} keyboardType="numeric"
                  value={editModal.price} onChangeText={(v) => setEditModal(prev => ({ ...prev, price: v }))} />
              </>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setEditModal({ visible: false, type: null, id: '' })} activeOpacity={0.7}>
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={saveEdit} activeOpacity={0.7}>
                <Text style={styles.modalConfirmText}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ===== 子组件：分栏 =====
function TabBar({
  tabs, active, onChange,
}: { tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabBar}
      style={styles.tabBarWrap}
    >
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
    </ScrollView>
  );
}

// ===== 子组件：月视图占位日历 =====
function MonthCalendar({
  marked, highlight, color,
}: { marked: Set<string>; highlight?: string; color: string }) {
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
      <Text style={styles.calTitle}>{year} 年 {month + 1} 月</Text>
      <View style={styles.calGrid}>
        {['日', '一', '二', '三', '四', '五', '六'].map(w => (
          <Text key={w} style={styles.calWeekday}>{w}</Text>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <View key={`e${i}`} style={styles.calCell} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const isMarked = marked.has(dateStr);
          const isHi = highlight === dateStr;
          return (
            <View key={dateStr} style={[styles.calCell, isHi && styles.calHi]}>
              <View style={[styles.calDot, isMarked && { backgroundColor: color }]}>
                <Text style={styles.calDay}>{d}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ===== 子组件：小节标题 =====
function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return <Text style={styles.sectionTitle}>{icon} {title}</Text>;
}

// ===== 样式 =====
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg },

  tabBarWrap: { maxHeight: 56 },
  tabBar: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.xs },
  tabItem: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: '#FFFFFF' },

  refreshBtn: {
    position: 'absolute',
    top: Spacing.lg + 8,
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

  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  tip: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: Spacing.sm },
  empty: { textAlign: 'center', color: Colors.textMuted, fontSize: FontSize.sm, paddingVertical: Spacing.lg },
  editHint: { fontSize: FontSize.xs, color: Colors.primary, marginTop: Spacing.xs, fontWeight: '600' },

  /* 编辑弹窗 */
  modalMask: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  modalBox: {
    width: '100%', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.xl, borderWidth: 1, borderColor: Colors.border,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: Spacing.md },
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

  /* 通用输入/按钮 */
  input: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: FontSize.base, fontWeight: 'bold' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  chip: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '600' },
  chipTextOn: { color: '#FFFFFF' },

  /* 情绪 */
  emojiRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  emojiBtn: {
    width: 44, height: 44, borderRadius: BorderRadius.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  emojiBtnOn: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight + '20' },
  emojiText: { fontSize: 24 },
  calendarEntry: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  calendarEntryText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },

  /* 外貌/衣物 */
  uploadBtn: {
    backgroundColor: Colors.background, borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md, alignItems: 'center',
    borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.primary, marginBottom: Spacing.sm,
  },
  uploadBtnText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '600' },
  thumb: { width: '100%', height: 160, borderRadius: BorderRadius.sm, marginBottom: Spacing.sm },
  thumbSm: { width: 56, height: 56, borderRadius: BorderRadius.sm, marginTop: Spacing.xs },
  clothCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md,
    marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
  },
  clothStyle: { fontSize: FontSize.base, fontWeight: '600', color: Colors.textPrimary },
  clothMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: Spacing.xs },
  clothLink: { fontSize: FontSize.xs, color: Colors.dianHong, marginTop: Spacing.xs, fontWeight: '600' },

  /* 日常记录 */
  dailyCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  dailyDone: { opacity: 0.55, backgroundColor: '#F5F5F0' },
  dailyCheck: { marginRight: Spacing.md },
  dailyCheckbox: { fontSize: 22 },
  dailyContent: { flex: 1 },
  dailyLabel: { fontSize: FontSize.base, color: Colors.textPrimary },
  dailyLabelDone: { textDecorationLine: 'line-through', color: Colors.textMuted },
  dailyPhoto: { padding: Spacing.xs },
  dailyPhotoText: { fontSize: 20 },

  /* 列表卡片 */
  listCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md,
    marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
  },
  listTitle: { fontSize: FontSize.base, fontWeight: '600', color: Colors.textPrimary },
  listMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: Spacing.xs },
  finRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  finCat: {
    fontSize: FontSize.xs, color: Colors.gold, fontWeight: '600',
    backgroundColor: Colors.gold + '20', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full,
  },

  /* 生理期 */
  predictBox: {
    backgroundColor: Colors.dianHong + '12', borderRadius: BorderRadius.md,
    padding: Spacing.md, marginTop: Spacing.sm, marginBottom: Spacing.sm,
  },
  predictLabel: { fontSize: FontSize.sm, fontWeight: 'bold', color: Colors.dianHong },
  predictText: { fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.dianHong, marginTop: Spacing.xs },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  switchLabel: { fontSize: FontSize.base, color: Colors.textPrimary },

  /* 手账 */
  thumbGrid: { width: 64, height: 64, borderRadius: BorderRadius.sm, marginRight: Spacing.xs, marginBottom: Spacing.xs },
  journalAdd: {
    width: 64, height: 64, borderRadius: BorderRadius.sm, borderWidth: 1,
    borderStyle: 'dashed', borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  journalAddText: { fontSize: 28, color: Colors.primary },
  journalCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md,
    marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
  },
  journalImgs: { flexDirection: 'row', flexWrap: 'wrap' },
  journalText: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs, lineHeight: 20 },

  /* 月历 */
  calWrap: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md,
    marginTop: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
  },
  calTitle: { fontSize: FontSize.base, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: Spacing.sm, textAlign: 'center' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calWeekday: { width: '14.28%', textAlign: 'center', fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: Spacing.xs },
  calCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  calHi: {},
  calDot: { width: 30, height: 30, borderRadius: BorderRadius.full, alignItems: 'center', justifyContent: 'center' },
  calDay: { fontSize: FontSize.xs, color: Colors.textPrimary },
});
