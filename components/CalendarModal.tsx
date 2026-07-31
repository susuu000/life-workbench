/**
 * 日历弹窗：点击首页日期打开，展示当月日历（高亮今天），可翻月。
 * 复刻旧版「月夕生活台」的日历入口。
 */
import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '@/lib/theme';

const HOLIDAYS: Record<string, string> = {
  '2026-01-01': '元旦', '2026-02-17': '春节', '2026-02-18': '春节', '2026-04-04': '清明',
  '2026-04-05': '清明', '2026-05-01': '劳动节', '2026-06-19': '端午', '2026-09-25': '中秋',
  '2026-10-01': '国庆', '2026-10-02': '国庆', '2026-10-03': '国庆',
};

function renderGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

export default function CalendarModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const cells = renderGrid(year, month);
  const ym = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const isToday = (d: number) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const shift = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++;; }
    setMonth(m); setYear(y);
  };

  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.mask}>
        <View style={styles.box}>
          <View style={styles.head}>
            <TouchableOpacity onPress={() => shift(-1)} activeOpacity={0.7}>
              <Text style={styles.nav}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{year}年{month + 1}月</Text>
            <TouchableOpacity onPress={() => shift(1)} activeOpacity={0.7}>
              <Text style={styles.nav}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{ marginLeft: 'auto' }}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.weekRow}>
            {weekdays.map((w) => (
              <Text key={w} style={styles.weekDay}>{w}</Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((d, i) => {
              if (d == null) return <View key={i} style={styles.cell} />;
              const hol = HOLIDAYS[ym(d)];
              return (
                <View key={i} style={[styles.cell, isToday(d) && styles.cellToday]}>
                  <Text style={[styles.dayNum, isToday(d) && styles.dayNumToday]}>{d}</Text>
                  {hol ? <Text style={styles.hol}>{hol}</Text> : null}
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  mask: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  box: {
    width: '100%', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.xl, borderWidth: 1, borderColor: Colors.border,
  },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  nav: { fontSize: 26, color: Colors.primary, paddingHorizontal: Spacing.md },
  title: { fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.textPrimary },
  close: { fontSize: 20, color: Colors.textMuted, paddingHorizontal: Spacing.sm },
  weekRow: { flexDirection: 'row', marginBottom: Spacing.sm },
  weekDay: { flex: 1, textAlign: 'center', fontSize: FontSize.xs, color: Colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center',
  },
  cellToday: {
    backgroundColor: Colors.primary + '18', borderRadius: BorderRadius.sm,
  },
  dayNum: { fontSize: FontSize.sm, color: Colors.textPrimary },
  dayNumToday: { color: Colors.primary, fontWeight: 'bold' },
  hol: { fontSize: 9, color: Colors.dianHong },
});
