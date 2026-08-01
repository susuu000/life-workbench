/**
 * DataExporter - 数据导出功能
 * 
 * 支持导出格式：
 * - CSV：打卡记录、任务完成记录
 * - JSON：完整数据备份
 * - 支持下载 / 复制到剪贴板 / 邮件发送
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, Platform, Share,
} from 'react-native';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { Colors, Spacing, FontSize, BorderRadius } from '@/lib/theme';
import { MODULE_META, type ModuleKey } from '@/lib/types';

// ===== 类型 =====
type ExportFormat = 'csv' | 'json';

interface ExportPreview {
  format: ExportFormat;
  label: string;
  size: string;
  recordCount: number;
}

// ===== 辅助函数 =====

/** 将数据转为 CSV 字符串 */
function toCSV(headers: string[], rows: string[][]): string {
  const escape = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };
  const headerLine = headers.map(escape).join(',');
  const dataLines = rows.map((row) => row.map(escape).join(','));
  return '\uFEFF' + [headerLine, ...dataLines].join('\n'); // BOM for Excel
}

/** 下载文件 */
function downloadFile(content: string, filename: string, mimeType: string) {
  if (Platform.OS === 'web') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

/** 分享文件（移动端） */
async function shareFile(content: string, filename: string, mimeType: string) {
  if (Platform.OS === 'web') {
    // Web 端：尝试 Web Share API
    if (navigator.share) {
      const blob = new Blob([content], { type: mimeType });
      const file = new File([blob], filename, { type: mimeType });
      try {
        await navigator.share({
          title: filename,
          files: [file],
        });
        return;
      } catch {
        // 降级为下载
      }
    }
    downloadFile(content, filename, mimeType);
  } else {
    await Share.share({
      title: filename,
      message: content,
    });
  }
}

// ===== 主组件 =====

export default function DataExporter() {
  const [loading, setLoading] = useState(false);
  const [previews, setPreviews] = useState<ExportPreview[]>([]);
  const [lastExport, setLastExport] = useState<string | null>(null);

  // 预览导出数据
  const previewExport = useCallback(async () => {
    setLoading(true);
    try {
      const uid = await getCurrentUserId();
      if (!uid) { Alert.alert('提示', '请先登录'); return; }

      // 获取打卡记录
      const { data: checkins, count: checkinCount } = await supabase
        .from('checkin_records')
        .select('*', { count: 'exact' })
        .eq('user_id', uid)
        .order('date', { ascending: false });

      // 获取任务记录
      const { data: tasks, count: taskCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact' })
        .eq('user_id', uid);

      const totalRecords = (checkinCount ?? 0) + (taskCount ?? 0);

      // 估算 JSON 大小
      const jsonData = JSON.stringify({ checkins, tasks }, null, 2);
      const jsonSize = `${(jsonData.length / 1024).toFixed(1)} KB`;

      setPreviews([
        {
          format: 'csv',
          label: '打卡 + 任务 CSV',
          size: `约 ${((checkinCount ?? 0) * 0.1 + (taskCount ?? 0) * 0.15).toFixed(1)} KB`,
          recordCount: totalRecords,
        },
        {
          format: 'json',
          label: '完整数据备份 JSON',
          size: jsonSize,
          recordCount: totalRecords,
        },
      ]);
    } catch (err) {
      console.error('Preview error:', err);
      Alert.alert('出错了', '无法预览导出数据');
    } finally {
      setLoading(false);
    }
  }, []);

  // 执行导出
  const doExport = useCallback(async (format: ExportFormat) => {
    setLoading(true);
    try {
      const uid = await getCurrentUserId();
      if (!uid) { Alert.alert('提示', '请先登录'); return; }

      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      if (format === 'csv') {
        // 导出打卡 CSV
        const { data: checkins } = await supabase
          .from('checkin_records')
          .select('*')
          .eq('user_id', uid)
          .order('date', { ascending: true });

        const { data: tasks } = await supabase
          .from('tasks')
          .select('*')
          .eq('user_id', uid)
          .order('order_index', { ascending: true });

        // 打卡 CSV
        const checkinCSV = toCSV(
          ['日期', '连续天数', '累计天数'],
          (checkins ?? []).map((c) => [c.date, String(c.streak_days), String(c.total_days)])
        );

        // 任务 CSV
        const taskCSV = toCSV(
          ['板块', '标题', '子模块', '完成状态', '完成时间', '复盘笔记'],
          (tasks ?? []).map((t) => [
            MODULE_META[t.module as ModuleKey]?.label || t.module,
            t.title || '',
            t.sub_module || '',
            t.done ? '已完成' : '未完成',
            t.completed_at ? new Date(t.completed_at).toLocaleDateString('zh-CN') : '',
            t.review_note || '',
          ])
        );

        const fullCSV = `# 月夕生活台 · 打卡记录\n# 导出时间: ${dateStr}\n\n${checkinCSV}\n\n# 任务记录\n\n${taskCSV}`;
        await shareFile(fullCSV, `yuexi-export-${dateStr}.csv`, 'text/csv;charset=utf-8');
      } else {
        // 导出 JSON
        const { data: checkins } = await supabase
          .from('checkin_records')
          .select('*')
          .eq('user_id', uid)
          .order('date', { ascending: false });

        const { data: tasks } = await supabase
          .from('tasks')
          .select('*')
          .eq('user_id', uid);

        const { data: collections } = await supabase
          .from('collections')
          .select('*')
          .eq('user_id', uid);

        const { data: settings } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', uid)
          .maybeSingle();

        const jsonData = JSON.stringify({
          exportDate: dateStr,
          appVersion: 'v3',
          data: { checkins, tasks, collections, settings },
        }, null, 2);

        await shareFile(jsonData, `yuexi-full-backup-${dateStr}.json`, 'application/json');
      }

      // 记录导出
      await supabase.from('export_records').insert({
        user_id: uid,
        export_type: format,
        record_count: previews.find((p) => p.format === format)?.recordCount || 0,
      });

      setLastExport(`${format.toUpperCase()} 导出完成 · ${dateStr}`);
      Alert.alert('✅ 导出成功', `数据已导出为 ${format.toUpperCase()} 文件。`);
    } catch (err) {
      console.error('Export error:', err);
      Alert.alert('导出失败', '请重试或检查网络连接。');
    } finally {
      setLoading(false);
    }
  }, [previews]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📦 数据导出</Text>
      <Text style={styles.hint}>
        导出你的打卡记录、任务数据和收藏内容。支持 CSV（Excel 可打开）和 JSON（完整备份）格式。
      </Text>

      {/* 预览按钮 */}
      <TouchableOpacity
        style={styles.previewBtn}
        onPress={previewExport}
        disabled={loading}
        activeOpacity={0.7}
      >
        <Text style={styles.previewBtnText}>
          {loading ? '⏳ 加载中…' : '📊 预览导出数据'}
        </Text>
      </TouchableOpacity>

      {/* 导出选项 */}
      {previews.map((p) => (
        <View key={p.format} style={styles.exportOption}>
          <View style={styles.exportInfo}>
            <Text style={styles.exportLabel}>{p.label}</Text>
            <Text style={styles.exportMeta}>
              {p.recordCount} 条记录 · {p.size}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={() => doExport(p.format)}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Text style={styles.exportBtnText}>
              {p.format === 'csv' ? '📥 导出 CSV' : '💾 导出 JSON'}
            </Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* 上次导出 */}
      {lastExport && (
        <View style={styles.lastExport}>
          <Text style={styles.lastExportText}>✅ {lastExport}</Text>
        </View>
      )}

      {/* 自动备份提示 */}
      <View style={styles.backupNote}>
        <Text style={styles.backupNoteTitle}>💡 数据安全建议</Text>
        <Text style={styles.backupNoteText}>
          建议每月导出一次 JSON 完整备份。云端数据由 Supabase 自动备份，但你也可以定期下载到本地保存。
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  hint: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  previewBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.md,
    alignSelf: 'flex-start',
  },
  previewBtnText: {
    fontSize: FontSize.sm,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  exportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  exportInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  exportLabel: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  exportMeta: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  exportBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  exportBtnText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  lastExport: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.success + '12',
    borderRadius: BorderRadius.sm,
  },
  lastExportText: {
    fontSize: FontSize.sm,
    color: Colors.success,
  },
  backupNote: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: Colors.backgroundWarm,
    borderRadius: BorderRadius.md,
  },
  backupNoteTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  backupNoteText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    lineHeight: 18,
  },
});
