/**
 * 天气弹窗：展示未来 3 天预报（今/明/后），支持切换城市。
 * 数据来自 get-weather 返回的 weather_cache.forecast。
 */
import React from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
} from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '@/lib/theme';

export interface ForecastDay {
  date: string;
  temp_max: number;
  temp_min: number;
  condition: string;
  icon_code: string;
}

function weatherEmoji(condition: string): string {
  if (/雨|雪|雷|雾|霾/.test(condition)) return '🌧️';
  if (/阴/.test(condition)) return '☁️';
  if (/多云|云/.test(condition)) return '⛅';
  if (/晴/.test(condition)) return '☀️';
  return '🌤️';
}

function weekdayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return days[d.getDay()];
}

export default function WeatherForecastModal({
  visible,
  city,
  forecast,
  onChangeCity,
  onClose,
}: {
  visible: boolean;
  city: string;
  forecast: ForecastDay[];
  onChangeCity: (city: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.mask}>
        <View style={styles.box}>
          <View style={styles.head}>
            <Text style={styles.title}>未来三天天气</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cityRow}>
            <Text style={styles.cityLabel}>城市</Text>
            <TextInput
              style={styles.cityInput}
              value={city}
              placeholder="如：宁波"
              placeholderTextColor={Colors.textMuted}
              onChangeText={onChangeCity}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
            {forecast.length === 0 ? (
              <Text style={styles.empty}>暂无预报数据</Text>
            ) : (
              forecast.map((d, i) => (
                <View key={d.date} style={styles.dayCard}>
                  <Text style={styles.dayName}>{i === 0 ? '今天' : weekdayLabel(d.date)}</Text>
                  <Text style={styles.dayIcon}>{weatherEmoji(d.condition)}</Text>
                  <Text style={styles.dayCond}>{d.condition}</Text>
                  <Text style={styles.dayTemp}>
                    {d.temp_max}° / {d.temp_min}°
                  </Text>
                  <Text style={styles.dayDate}>{d.date?.slice(5)}</Text>
                </View>
              ))
            )}
          </ScrollView>
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
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  title: { fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.textPrimary },
  close: { fontSize: 20, color: Colors.textMuted, paddingHorizontal: Spacing.sm },
  cityRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md, gap: Spacing.sm },
  cityLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  cityInput: {
    flex: 1, backgroundColor: Colors.background, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: FontSize.base, color: Colors.textPrimary,
  },
  scroll: { flexDirection: 'row' },
  dayCard: {
    width: 110, backgroundColor: Colors.background, borderRadius: BorderRadius.md,
    padding: Spacing.lg, marginRight: Spacing.md, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  dayName: { fontSize: FontSize.sm, fontWeight: 'bold', color: Colors.primary, marginBottom: Spacing.sm },
  dayIcon: { fontSize: 32, marginBottom: Spacing.xs },
  dayCond: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: Spacing.xs },
  dayTemp: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  dayDate: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  empty: { fontSize: FontSize.sm, color: Colors.textMuted, padding: Spacing.lg },
});
