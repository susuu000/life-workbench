/**
 * WeatherForecastModal - 天气预报弹窗
 * 
 * TODO: 接入完整天气 API 数据
 * 当前为简化占位版本
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput,
} from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '@/lib/theme';

export interface ForecastDay {
  date: string;
  condition: string;
  temp_high: number;
  temp_low: number;
  icon?: string;
}

interface WeatherForecastModalProps {
  visible: boolean;
  city: string;
  forecast: ForecastDay[];
  onChangeCity: (city: string) => void;
  onClose: () => void;
}

function weatherEmoji(condition: string): string {
  if (/雨|雪|雷|雾|霾/.test(condition)) return '🌧️';
  if (/阴/.test(condition)) return '☁️';
  if (/多云|云/.test(condition)) return '⛅';
  if (/晴/.test(condition)) return '☀️';
  return '🌤️';
}

export default function WeatherForecastModal({
  visible, city, forecast, onChangeCity, onClose,
}: WeatherForecastModalProps) {
  const [editCity, setEditCity] = useState(city);

  const handleSubmit = () => {
    const trimmed = editCity.trim();
    if (trimmed && trimmed !== city) {
      onChangeCity(trimmed);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.mask} activeOpacity={1} onPress={onClose}>
        <View style={styles.box} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>🌤️ 天气预报</Text>

          {/* 城市切换 */}
          <View style={styles.cityRow}>
            <TextInput
              style={styles.cityInput}
              value={editCity}
              onChangeText={setEditCity}
              onSubmitEditing={handleSubmit}
              placeholder="输入城市名"
              placeholderTextColor={Colors.textMuted}
            />
            <TouchableOpacity style={styles.cityBtn} onPress={handleSubmit}>
              <Text style={styles.cityBtnText}>切换</Text>
            </TouchableOpacity>
          </View>

          {/* 预报列表 */}
          {forecast.length === 0 ? (
            <Text style={styles.empty}>暂无天气预报数据</Text>
          ) : (
            <View style={styles.forecastList}>
              {forecast.map((day, i) => (
                <View key={day.date || i} style={styles.forecastItem}>
                  <Text style={styles.forecastDate}>{day.date}</Text>
                  <Text style={styles.forecastIcon}>
                    {day.icon ? day.icon : weatherEmoji(day.condition)}
                  </Text>
                  <Text style={styles.forecastTemp}>
                    {day.temp_low}° ~ {day.temp_high}°
                  </Text>
                  <Text style={styles.forecastCond}>{day.condition}</Text>
                </View>
              ))}
            </View>
          )}

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
    justifyContent: 'flex-end',
  },
  box: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    maxHeight: '80%',
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  cityRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  cityInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cityBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
  },
  cityBtnText: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  empty: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    paddingVertical: Spacing.xl,
  },
  forecastList: {
    gap: Spacing.sm,
  },
  forecastItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  forecastDate: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    width: 60,
  },
  forecastIcon: {
    fontSize: 24,
  },
  forecastTemp: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
  },
  forecastCond: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  closeBtn: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  closeText: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
