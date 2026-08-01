/**
 * CalendarModal - 日历弹窗组件
 * 
 * TODO: 完整实现日历打卡视图
 * 当前为简化占位版本
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '@/lib/theme';

interface CalendarModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function CalendarModal({ visible, onClose }: CalendarModalProps) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const today = now.getDate();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.mask} activeOpacity={1} onPress={onClose}>
        <View style={styles.box} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>
            {year} 年 {month} 月
          </Text>
          <View style={styles.grid}>
            {weekdays.map((w) => (
              <Text key={w} style={styles.weekday}>{w}</Text>
            ))}
            {cells.map((d, i) => (
              <View key={i} style={styles.cell}>
                {d !== null && (
                  <View style={[styles.dot, d === today && styles.dotToday]}>
                    <Text style={[styles.day, d === today && styles.dayToday]}>{d}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>关闭</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  mask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  box: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
  },
  weekday: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
  },
  cell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotToday: {
    backgroundColor: Colors.primary,
  },
  day: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  dayToday: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  closeBtn: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  closeText: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
});
