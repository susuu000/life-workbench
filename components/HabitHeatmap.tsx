/**
 * HabitHeatmap - 习惯热力图组件
 * 
 * GitHub 贡献图风格，展示近一年的打卡/学习数据。
 * 
 * 特性：
 * - 52 周 × 7 天的方格矩阵
 * - 颜色深浅表示打卡/学习活跃度
 * - 点击方格查看当日详情
 * - 月标签 + 图例
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, ActivityIndicator, Modal, TouchableWithoutFeedback,
} from 'react-native';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { Colors, Spacing, FontSize, BorderRadius } from '@/lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ===== 类型 =====
interface DayCell {
  date: string;       // YYYY-MM-DD
  dayOfWeek: number;  // 0=Sun
  weekIndex: number;  // 0-52
  level: 0 | 1 | 2 | 3 | 4; // 活跃等级
  count: number;       // 打卡数/完成数
  details?: string[];  // 当日完成事项
}

interface HeatmapProps {
  type?: 'checkin' | 'tasks';
  onDayPress?: (date: string, data: DayCell) => void;
}

// ===== 活跃等级颜色（对齐 GitHub 风格）=====
const HEAT_COLORS: Record<number, string> = {
  0: '#EBEDF0',  // 无活动
  1: '#C6E4D6',  // 低（1-2项）
  2: '#7BC89C',  // 中（3-4项）
  3: '#3B9C6E',  // 高（5-6项）
  4: '#216E39',  // 极高（7+项）
};

// ===== 辅助函数 =====

/** 生成近 52 周的日期网格 */
function generateWeeks(): DayCell[] {
  const cells: DayCell[] = [];
  const now = new Date();
  
  // 从 52 周前的周日开始
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 364); // 约52周
  // 对齐到周日
  startDate.setDate(startDate.getDate() - startDate.getDay());

  for (let i = 0; i < 371; i++) { // 53周×7天
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    
    if (date > now) break;
    
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();
    const daysSinceStart = Math.floor((date.getTime() - startDate.getTime()) / 86400000);
    const weekIndex = Math.floor(daysSinceStart / 7);
    
    cells.push({
      date: dateStr,
      dayOfWeek,
      weekIndex,
      level: 0,
      count: 0,
    });
  }
  
  return cells;
}

/** 计算活跃等级 */
function calcLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 6) return 3;
  return 4;
}

// ===== 月标签 =====
const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

// ===== 主组件 =====

export default function HabitHeatmap({ type = 'checkin', onDayPress }: HeatmapProps) {
  const [cells, setCells] = useState<DayCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState<DayCell | null>(null);
  const [totalDays, setTotalDays] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);

  // 加载数据
  useEffect(() => {
    loadData();
  }, [type]);

  const loadData = async () => {
    setLoading(true);
    try {
      const uid = await getCurrentUserId();
      if (!uid) { setLoading(false); return; }

      const baseCells = generateWeeks();

      if (type === 'checkin') {
        // 加载打卡数据
        const { data: checkins } = await supabase
          .from('checkin_records')
          .select('date, streak_days')
          .eq('user_id', uid)
          .gte('date', baseCells[0]?.date || '2026-01-01');

        const checkinMap = new Map<string, number>();
        let maxS = 0;
        (checkins ?? []).forEach((c) => {
          checkinMap.set(c.date, c.streak_days || 1);
          if ((c.streak_days || 0) > maxS) maxS = c.streak_days || 0;
        });

        baseCells.forEach((cell) => {
          const hasCheckin = checkinMap.has(cell.date);
          cell.count = hasCheckin ? 1 : 0;
          cell.level = hasCheckin ? 2 : 0; // 打卡统一为 level 2
          if (hasCheckin) cell.details = ['已打卡'];
        });

        setTotalDays(checkinMap.size);
        setMaxStreak(maxS);
      } else {
        // 加载任务完成数据
        const { data: tasks } = await supabase
          .from('tasks')
          .select('done, completed_at, title')
          .eq('user_id', uid)
          .eq('done', true)
          .not('completed_at', 'is', null);

        const taskMap = new Map<string, { count: number; titles: string[] }>();
        (tasks ?? []).forEach((t) => {
          const date = t.completed_at?.split('T')[0];
          if (!date) return;
          const entry = taskMap.get(date) || { count: 0, titles: [] };
          entry.count++;
          entry.titles.push(t.title || '未知任务');
          taskMap.set(date, entry);
        });

        baseCells.forEach((cell) => {
          const entry = taskMap.get(cell.date);
          if (entry) {
            cell.count = entry.count;
            cell.level = calcLevel(entry.count);
            cell.details = entry.titles;
          }
        });

        setTotalDays(taskMap.size);
      }

      setCells(baseCells);
    } catch (err) {
      console.error('Heatmap load error:', err);
    } finally {
      setLoading(false);
    }
  };

  // 按列（周）和行（星期几）组织
  const grid = useMemo(() => {
    const weekMap = new Map<number, DayCell[]>();
    cells.forEach((cell) => {
      if (!weekMap.has(cell.weekIndex)) weekMap.set(cell.weekIndex, []);
      weekMap.get(cell.weekIndex)!.push(cell);
    });

    // 填充每周的7天
    const weeks: DayCell[][] = [];
    weekMap.forEach((weekCells) => {
      const padded: DayCell[] = [];
      for (let d = 0; d < 7; d++) {
        const cell = weekCells.find((c) => c.dayOfWeek === d);
        padded.push(cell || { date: '', dayOfWeek: d, weekIndex: -1, level: 0, count: 0 });
      }
      weeks.push(padded);
    });

    return weeks;
  }, [cells]);

  // 月标签位置
  const monthMarkers = useMemo(() => {
    const markers: { label: string; weekIndex: number }[] = [];
    const seen = new Set<number>();
    cells.forEach((cell) => {
      const month = parseInt(cell.date.split('-')[1] || '0');
      if (month && !seen.has(month)) {
        seen.add(month);
        markers.push({ label: MONTH_LABELS[month - 1], weekIndex: cell.weekIndex });
      }
    });
    return markers;
  }, [cells]);

  const cellSize = Math.min(14, (SCREEN_WIDTH - 80) / 53);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={Colors.primary} style={{ padding: Spacing.xl }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 统计摘要 */}
      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalDays}</Text>
          <Text style={styles.statLabel}>{type === 'checkin' ? '打卡天数' : '学习天数'}</Text>
        </View>
        {type === 'checkin' && (
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{maxStreak}</Text>
            <Text style={styles.statLabel}>最长连续</Text>
          </View>
        )}
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{cells.filter((c) => c.count > 0).length}</Text>
          <Text style={styles.statLabel}>近一年活跃</Text>
        </View>
      </View>

      {/* 热力图 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.heatmapScroll}>
        <View>
          {/* 月标签行 */}
          <View style={styles.monthRow}>
            <View style={{ width: 24 }} />
            {monthMarkers.map((m, i) => (
              <Text
                key={i}
                style={[
                  styles.monthLabel,
                  { left: m.weekIndex * (cellSize + 2) + 24 },
                ]}
              >
                {m.label}
              </Text>
            ))}
          </View>

          {/* 网格 */}
          <View style={styles.gridRow}>
            {/* 星期标签 */}
            <View style={styles.weekdayCol}>
              {['', '一', '', '三', '', '五', ''].map((label, i) => (
                <Text key={i} style={[styles.weekdayLabel, { height: cellSize + 2 }]}>
                  {label}
                </Text>
              ))}
            </View>

            {/* 方格矩阵 */}
            <View style={styles.gridMatrix}>
              {Array.from({ length: 7 }).map((_, dayIndex) => (
                <View key={dayIndex} style={styles.gridRowLine}>
                  {grid.map((week, weekIndex) => {
                    const cell = week[dayIndex];
                    const hasData = cell && cell.date;
                    return (
                      <TouchableOpacity
                        key={`${weekIndex}-${dayIndex}`}
                        style={[
                          styles.cell,
                          {
                            width: cellSize,
                            height: cellSize,
                            backgroundColor: hasData ? HEAT_COLORS[cell.level] : 'transparent',
                            borderRadius: 2,
                          },
                        ]}
                        disabled={!hasData}
                        onPress={() => {
                          setSelectedCell(cell);
                          onDayPress?.(cell.date, cell);
                        }}
                        activeOpacity={0.7}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </View>

          {/* 图例 */}
          <View style={styles.legend}>
            <Text style={styles.legendLabel}>少</Text>
            {[0, 1, 2, 3, 4].map((level) => (
              <View
                key={level}
                style={[styles.legendCell, { backgroundColor: HEAT_COLORS[level] }]}
              />
            ))}
            <Text style={styles.legendLabel}>多</Text>
          </View>
        </View>
      </ScrollView>

      {/* 日期详情弹窗 */}
      <Modal visible={!!selectedCell} transparent animationType="fade" onRequestClose={() => setSelectedCell(null)}>
        <TouchableWithoutFeedback onPress={() => setSelectedCell(null)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalBox}>
                <Text style={styles.modalDate}>{selectedCell?.date}</Text>
                <Text style={styles.modalCount}>
                  {selectedCell?.count || 0} 次{type === 'checkin' ? '打卡' : '任务完成'}
                </Text>
                {selectedCell?.details && selectedCell.details.length > 0 && (
                  <View style={styles.modalDetails}>
                    {selectedCell.details.map((d, i) => (
                      <Text key={i} style={styles.modalDetailItem}>• {d}</Text>
                    ))}
                  </View>
                )}
                <TouchableOpacity
                  style={styles.modalClose}
                  onPress={() => setSelectedCell(null)}
                >
                  <Text style={styles.modalCloseText}>关闭</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  heatmapScroll: {
    // flex: 1,
  },
  monthRow: {
    flexDirection: 'row',
    marginBottom: 4,
    position: 'relative',
    height: 20,
  },
  monthLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    position: 'absolute',
  },
  gridRow: {
    flexDirection: 'row',
  },
  weekdayCol: {
    marginRight: 4,
  },
  weekdayLabel: {
    fontSize: 9,
    color: Colors.textMuted,
    textAlign: 'right',
    width: 18,
    lineHeight: 14,
  },
  gridMatrix: {},
  gridRowLine: {
    flexDirection: 'row',
  },
  cell: {
    margin: 1,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: Spacing.sm,
    gap: 2,
  },
  legendLabel: {
    fontSize: 9,
    color: Colors.textMuted,
    marginHorizontal: 4,
  },
  legendCell: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalBox: {
    width: 260,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  modalDate: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  modalCount: {
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  modalDetails: {
    width: '100%',
    marginBottom: Spacing.lg,
  },
  modalDetailItem: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  modalClose: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
  },
  modalCloseText: {
    fontSize: FontSize.sm,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
