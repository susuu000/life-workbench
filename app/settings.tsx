import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { Colors, Spacing, FontSize, BorderRadius } from '@/lib/theme';
import { useTheme, applyWebFontFamily } from '@/lib/themeRuntime';
import type { Profile, UserSettings } from '@/lib/types';

/** 设置页 · 个人资料 / 天气 / 外观（部分持久化到 profiles / user_settings） */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const { setOverrides, fontFamilyCss } = useTheme();

  const load = useCallback(async () => {
    const uid = await getCurrentUserId();
    if (!uid) return;
    const { data: p } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();
    if (p) setProfile(p as Profile);

    const { data: s } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();
    if (s) {
      setSettings(s as UserSettings);
    } else {
      // 首次进入：创建默认设置行
      const { data: created } = await supabase
        .from('user_settings')
        .insert({ user_id: uid })
        .select()
        .single();
      if (created) setSettings(created as UserSettings);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: profile.display_name })
      .eq('id', profile.id);
    setSaving(false);
    if (error) Alert.alert('保存失败', error.message);
    else Alert.alert('已保存', '名称已更新');
  };

  const patchSettings = async (patch: Partial<UserSettings>) => {
    if (!settings) return;
    const uid = await getCurrentUserId();
    if (!uid) return;
    setSettings({ ...settings, ...patch });
    const { error } = await supabase
      .from('user_settings')
      .update(patch)
      .eq('user_id', uid);
    if (error) Alert.alert('保存失败', error.message);
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* 顶部返回 */}
      <TouchableOpacity style={styles.backRow} onPress={() => router.back()} activeOpacity={0.7}>
        <Text style={styles.backText}>‹ 返回</Text>
        <Text style={styles.title}>设置</Text>
        <View style={{ width: 48 }} />
      </TouchableOpacity>

      {/* 个人资料 */}
      <SectionTitle title="👤 个人资料" />
      <Card>
        <Field label="显示名称">
          <TextInput
            style={styles.input}
            value={profile?.display_name ?? ''}
            placeholder="请输入名称"
            placeholderTextColor={Colors.textMuted}
            onChangeText={(t) => setProfile((p) => (p ? { ...p, display_name: t } : p))}
          />
        </Field>
        <TouchableOpacity style={styles.saveBtn} onPress={saveProfile} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? '保存中…' : '保存名称'}</Text>
        </TouchableOpacity>
      </Card>

      {/* 天气 */}
      <SectionTitle title="🌤️ 天气" />
      <Card>
        <Field label="默认城市">
          <TextInput
            style={styles.input}
            value={settings?.weather_city ?? ''}
            placeholder="如：宁波"
            placeholderTextColor={Colors.textMuted}
            onChangeText={(t) => patchSettings({ weather_city: t })}
          />
        </Field>
        <Row>
          <Text style={styles.rowLabel}>显示天气</Text>
          <Switch
            value={settings?.weather_enabled ?? true}
            onValueChange={(v) => patchSettings({ weather_enabled: v })}
            trackColor={{ true: Colors.primary, false: Colors.border }}
            thumbColor="#FFFFFF"
          />
        </Row>
        <Row>
          <Text style={styles.rowLabel}>每日自动刷新内容</Text>
          <Switch
            value={settings?.daily_refresh_enabled ?? true}
            onValueChange={(v) => patchSettings({ daily_refresh_enabled: v })}
            trackColor={{ true: Colors.primary, false: Colors.border }}
            thumbColor="#FFFFFF"
          />
        </Row>
      </Card>

      {/* 外观（持久化，全局主题切换将在后续版本启用） */}
      <SectionTitle title="🎨 外观" />
      <Card>
        <Field label="APP 名称">
          <TextInput
            style={styles.input}
            value={settings?.app_name ?? 'Susu'}
            placeholder="Susu"
            placeholderTextColor={Colors.textMuted}
            onChangeText={(t) => patchSettings({ app_name: t })}
          />
        </Field>
        <Field label="主题色（十六进制）">
          <TextInput
            style={styles.input}
            value={settings?.theme_color ?? '#2E6F7E'}
            placeholder="#2E6F7E"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="characters"
            onChangeText={(t) => {
              patchSettings({ theme_color: t });
              setOverrides({ themeColor: t });
              applyWebFontFamily(fontFamilyCss);
            }}
          />
        </Field>
        <Field label="正文字号（px）">
          <TextInput
            style={styles.input}
            value={String(settings?.font_size ?? 16)}
            placeholder="16"
            placeholderTextColor={Colors.textMuted}
            keyboardType="number-pad"
            onChangeText={(t) => {
              const n = parseInt(t, 10);
              if (!isNaN(n)) {
                patchSettings({ font_size: n });
                setOverrides({ fontSize: n });
              }
            }}
          />
        </Field>
        <Field label="正文字体">
          <View style={styles.segRow}>
            {(['default', 'serif', 'kai'] as const).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.seg, (settings?.font_family ?? 'default') === f && styles.segActive]}
                onPress={() => {
                  patchSettings({ font_family: f });
                  setOverrides({ fontFamily: f });
                  applyWebFontFamily(
                    f === 'serif' ? '"Songti SC","SimSun",serif' : f === 'kai' ? '"Kaiti SC","KaiTi",serif' : '"PingFang SC","Noto Sans SC",sans-serif'
                  );
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.segText, (settings?.font_family ?? 'default') === f && styles.segTextActive]}>
                  {f === 'default' ? '黑体' : f === 'serif' ? '宋体' : '楷体'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>
        <Field label="界面密度">
          <View style={styles.segRow}>
            {(['comfortable', 'compact'] as const).map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.seg, (settings?.density ?? 'comfortable') === d && styles.segActive]}
                onPress={() => {
                  patchSettings({ density: d });
                  setOverrides({ density: d });
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.segText, (settings?.density ?? 'comfortable') === d && styles.segTextActive]}>
                  {d === 'comfortable' ? '宽松' : '紧凑'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>
        <Text style={styles.note}>
          主题色、字体、字号、密度修改后即时生效（主色在所有界面实时更新；字号/字体在网页端通过根字体继承，原生端主色与密度即时生效）。
        </Text>
      </Card>

      {/* 板块每日目标 */}
      <SectionTitle title="🎯 板块每日目标" />
      <Card>
        {(['english', 'ai_learning', 'reading', 'podcast', 'social_media', 'self_explore'] as const).map((m) => {
          const labels: Record<string, string> = {
            english: '英语', ai_learning: 'AI学习', reading: '阅读',
            podcast: '播客', social_media: '自媒体', self_explore: '自我探索',
          };
          const targets = (settings?.module_targets as Record<string, number> | null) ?? {};
          const val = targets[m] ?? 0;
          return (
            <Field key={m} label={labels[m] || m}>
              <TextInput
                style={styles.input}
                value={String(val)}
                placeholder="0 表示动态计算"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                onChangeText={(t) => {
                  const n = parseInt(t, 10);
                  const next = { ...targets, [m]: isNaN(n) ? 0 : Math.max(0, n) };
                  patchSettings({ module_targets: next } as any);
                }}
              />
            </Field>
          );
        })}
        <Text style={styles.note}>
          默认目标：英语 4 / AI学习 2 / 阅读动态 / 播客 5 / 自媒体 2 / 自我探索 3。设 0 表示根据实际任务数动态显示。
        </Text>
      </Card>

      {/* 关于 */}
      <SectionTitle title="ℹ️ 关于" />
      <Card>
        <Text style={styles.note}>
          Susu · 生活工作台{'\n'}
          数据通过 Supabase 云端同步，支持离线缓存与本地持久化。{'\n'}
          自动抓取内容由后台定时任务更新；无法抓取的板块由你手动精选。
        </Text>
      </Card>

      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },

  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.lg,
  },
  backText: { fontSize: FontSize.base, color: Colors.primary, width: 48 },
  title: { fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.textPrimary },

  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  field: { marginBottom: Spacing.md },
  fieldLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  rowLabel: { fontSize: FontSize.base, color: Colors.textPrimary },
  saveBtn: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  saveBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: FontSize.sm },
  note: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    lineHeight: 18,
    marginTop: Spacing.sm,
  },
  segRow: { flexDirection: 'row', gap: Spacing.sm },
  seg: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full, backgroundColor: Colors.background,
    borderWidth: 1, borderColor: Colors.border,
  },
  segActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  segText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  segTextActive: { color: '#FFFFFF' },
});
