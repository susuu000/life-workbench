/**
 * PushNotificationManager - Web Push 通知管理
 * 
 * 功能：
 * 1. 请求通知权限
 * 2. 订阅 Push 服务
 * 3. 将订阅信息存储到 Supabase
 * 4. 管理每日打卡提醒开关
 * 
 * 注意：
 * - iOS Safari 16.4+ 才支持 Web Push（需添加到主屏幕）
 * - 需要 VAPID 密钥对（通过 Supabase Edge Function 管理）
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, Platform } from 'react-native';
import { supabase, getCurrentUserId, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';
import { Colors, Spacing, FontSize, BorderRadius } from '@/lib/theme';

// ===== 类型 =====
interface PushSubscriptionInfo {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// ===== URL Base64 转换工具 =====
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ===== 主组件 =====
export default function PushNotificationManager() {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [permissionState, setPermissionState] = useState<string>('default');
  const [loading, setLoading] = useState(true);

  // 检测支持
  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setPushSupported(supported);
    if (supported) {
      checkPermission();
    }
    loadSettings();
  }, []);

  const checkPermission = () => {
    if ('Notification' in window) {
      setPermissionState(Notification.permission);
    }
  };

  const loadSettings = async () => {
    const uid = await getCurrentUserId();
    if (!uid) { setLoading(false); return; }
    const { data } = await supabase
      .from('user_settings')
      .select('push_enabled, push_reminder_time')
      .eq('user_id', uid)
      .maybeSingle();
    if (data?.push_enabled) setPushEnabled(true);
    setLoading(false);
  };

  // 请求权限并订阅
  const requestPermission = useCallback(async () => {
    if (!pushSupported) {
      Alert.alert('不支持', '您的浏览器不支持推送通知。\n\niOS Safari 16.4+ 支持，需将本页添加到主屏幕。');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermissionState(permission);

      if (permission !== 'granted') {
        Alert.alert('权限被拒绝', '请在浏览器设置中允许通知权限。');
        return;
      }

      await subscribeUser();
    } catch (err) {
      console.error('Push permission error:', err);
      Alert.alert('出错了', '无法请求通知权限，请检查浏览器设置。');
    }
  }, [pushSupported]);

  // 订阅 Push
  const subscribeUser = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;

      // 获取 VAPID 公钥（从 Supabase Edge Function）
      const vapidRes = await fetch(
        `${SUPABASE_URL}/functions/v1/push-manage`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'get-vapid-key' }),
        }
      );
      const vapidData = await vapidRes.json();
      const vapidPublicKey = vapidData?.publicKey;
      if (!vapidPublicKey) throw new Error('No VAPID key');

      // 订阅
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const subJson = subscription.toJSON();
      const pushInfo: PushSubscriptionInfo = {
        endpoint: subJson.endpoint!,
        keys: {
          p256dh: subJson.keys!.p256dh,
          auth: subJson.keys!.auth,
        },
      };

      // 保存到 Supabase
      const uid = await getCurrentUserId();
      if (uid) {
        await fetch(`${SUPABASE_URL}/functions/v1/push-manage`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'subscribe',
            userId: uid,
            subscription: pushInfo,
            reminderTime: '20:00', // 默认晚上8点提醒
          }),
        });

        await supabase.from('user_settings').upsert({
          user_id: uid,
          push_enabled: true,
          push_reminder_time: '20:00',
        }, { onConflict: 'user_id' });

        setPushEnabled(true);
        Alert.alert('✅ 已开启', '每日打卡提醒已开启，默认晚上8点推送。');
      }
    } catch (err) {
      console.error('Subscribe error:', err);
      throw err;
    }
  };

  // 取消订阅
  const unsubscribeUser = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();

        const uid = await getCurrentUserId();
        if (uid) {
          await fetch(`${SUPABASE_URL}/functions/v1/push-manage`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'unsubscribe',
              userId: uid,
            }),
          });

          await supabase.from('user_settings').upsert({
            user_id: uid,
            push_enabled: false,
          }, { onConflict: 'user_id' });
        }

        setPushEnabled(false);
        Alert.alert('已关闭', '每日打卡提醒已关闭。');
      }
    } catch (err) {
      console.error('Unsubscribe error:', err);
    }
  };

  const togglePush = async (value: boolean) => {
    if (value) {
      await requestPermission();
    } else {
      await unsubscribeUser();
    }
  };

  // 发送测试通知
  const sendTestNotification = async () => {
    try {
      const uid = await getCurrentUserId();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/push-manage`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'test',
          userId: uid,
        }),
      });
      if (res.ok) {
        Alert.alert('已发送', '测试通知已发送，请查看。');
      } else {
        Alert.alert('发送失败', '请确认已开启通知权限。');
      }
    } catch {
      Alert.alert('发送失败', '网络错误，请重试。');
    }
  };

  if (Platform.OS !== 'web') return null;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.info}>
          <Text style={styles.label}>📬 每日打卡提醒</Text>
          <Text style={styles.hint}>
            {pushSupported
              ? permissionState === 'granted'
                ? '已授权 · 默认每晚8点推送'
                : '点击开启后授权通知权限'
              : '需要 iOS 16.4+ 或 Chrome 浏览器'}
          </Text>
        </View>
        <Switch
          value={pushEnabled}
          onValueChange={togglePush}
          trackColor={{ false: Colors.border, true: Colors.primaryLight }}
          thumbColor={pushEnabled ? Colors.primary : '#f4f3f4'}
          disabled={!pushSupported || loading}
        />
      </View>
      {pushEnabled && (
        <TouchableOpacity style={styles.testBtn} onPress={sendTestNotification} activeOpacity={0.7}>
          <Text style={styles.testBtnText}>🔔 发送测试通知</Text>
        </TouchableOpacity>
      )}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  info: { flex: 1, marginRight: Spacing.md },
  label: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  hint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  testBtn: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.primary + '12',
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  testBtnText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
});
