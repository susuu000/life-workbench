/**
 * 翻页时钟：大号时间卡，默认显示 HH:MM，点击展开秒。
 * 复刻旧版「月夕生活台」的翻牌时钟观感（数字变化时做轻微翻转动画）。
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { useTheme } from '@/lib/themeRuntime';
import { Spacing, FontSize } from '@/lib/theme';

function Digit({ value, color }: { value: string; color: string }) {
  const prev = useRef(value);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }).start();
    }
  }, [value, anim]);

  const rotateX = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['90deg', '0deg', '0deg'],
  });

  return (
    <View style={styles.digitBox}>
      <Animated.Text
        style={[
          styles.digit,
          { color, transform: [{ rotateX }] },
        ]}
      >
        {value}
      </Animated.Text>
    </View>
  );
}

export default function FlipClock({ onToggle }: { onToggle?: () => void }) {
  const { colors } = useTheme();
  const [now, setNow] = useState(new Date());
  const [showSeconds, setShowSeconds] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  const toggle = () => {
    setShowSeconds((s) => !s);
    onToggle?.();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={toggle}
      style={[styles.card, { backgroundColor: colors.primary }]}
    >
      <View style={styles.row}>
        <Digit value={hh[0]} color="#FFFFFF" />
        <Digit value={hh[1]} color="#FFFFFF" />
        <Text style={[styles.colon, { color: '#FFFFFF' }]}>:</Text>
        <Digit value={mm[0]} color="#FFFFFF" />
        <Digit value={mm[1]} color="#FFFFFF" />
        {showSeconds && (
          <>
            <Text style={[styles.colon, { color: '#FFFFFF' }]}>:</Text>
            <Digit value={ss[0]} color="#FFFFFF" />
            <Digit value={ss[1]} color="#FFFFFF" />
          </>
        )}
      </View>
      <Text style={styles.hint}>{showSeconds ? '点击收起秒' : '点击显示秒'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 180,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  digitBox: {
    width: 46,
    height: 72,
    marginHorizontal: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  digit: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Times New Roman' : 'serif',
  },
  colon: {
    fontSize: 52,
    fontWeight: 'bold',
    marginHorizontal: 2,
  },
  hint: {
    marginTop: Spacing.sm,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.7)',
  },
});
