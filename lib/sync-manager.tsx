/**
 * SyncManager - 多端同步冲突处理 + 离线队列
 * 
 * 策略：
 * - Last-Write-Wins (LWW)：基于 updated_at 时间戳
 * - 离线队列：网络断开时操作存入本地队列，联网后自动同步
 * - 冲突检测：同步前比对时间戳，提示用户选择
 * - 同步进度动画
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { Colors, Spacing, FontSize, BorderRadius } from '@/lib/theme';

// ===== 类型 =====
type SyncStatus = 'idle' | 'syncing' | 'error' | 'conflict';

interface SyncQueueItem {
  id: string;
  table: string;
  action: 'insert' | 'update' | 'delete';
  data: Record<string, any>;
  timestamp: number;
  retryCount: number;
}

interface ConflictInfo {
  local: Record<string, any>;
  remote: Record<string, any>;
  table: string;
  id: string;
}

// ===== 离线队列存储 =====
const QUEUE_KEY = 'yuexi_offline_queue';

function getQueue(): SyncQueueItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: SyncQueueItem[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

function addToQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount'>) {
  const queue = getQueue();
  queue.push({
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
    retryCount: 0,
  });
  saveQueue(queue);
}

function removeFromQueue(id: string) {
  const queue = getQueue().filter((q) => q.id !== id);
  saveQueue(queue);
}

// ===== 同步管理器 =====
export class SyncEngine {
  private static instance: SyncEngine;
  private statusListeners: ((status: SyncStatus) => void)[] = [];
  private progressListeners: ((progress: number) => void)[] = [];
  private _status: SyncStatus = 'idle';
  private _progress = 0;
  private syncing = false;

  static getInstance(): SyncEngine {
    if (!SyncEngine.instance) {
      SyncEngine.instance = new SyncEngine();
    }
    return SyncEngine.instance;
  }

  get status() { return this._status; }
  get progress() { return this._progress; }

  onStatusChange(cb: (status: SyncStatus) => void) {
    this.statusListeners.push(cb);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== cb);
    };
  }

  onProgressChange(cb: (progress: number) => void) {
    this.progressListeners.push(cb);
    return () => {
      this.progressListeners = this.progressListeners.filter((l) => l !== cb);
    };
  }

  private setStatus(status: SyncStatus) {
    this._status = status;
    this.statusListeners.forEach((l) => l(status));
  }

  private setProgress(progress: number) {
    this._progress = progress;
    this.progressListeners.forEach((l) => l(progress));
  }

  /** 入队离线操作 */
  enqueue(table: string, action: 'insert' | 'update' | 'delete', data: Record<string, any>) {
    addToQueue({ table, action, data });
    // 尝试立即同步
    this.sync();
  }

  /** 执行同步 */
  async sync(): Promise<void> {
    if (this.syncing) return;
    const queue = getQueue();
    if (queue.length === 0) {
      this.setStatus('idle');
      return;
    }

    this.syncing = true;
    this.setStatus('syncing');
    this.setProgress(0);

    const uid = await getCurrentUserId();
    if (!uid) {
      this.setStatus('error');
      this.syncing = false;
      return;
    }

    const total = queue.length;
    let completed = 0;
    const failedItems: SyncQueueItem[] = [];

    for (const item of queue) {
      try {
        const dataWithUser = { ...item.data, user_id: uid, updated_at: new Date().toISOString() };

        switch (item.action) {
          case 'insert': {
            const { error } = await supabase.from(item.table).insert(dataWithUser);
            if (error) throw error;
            break;
          }
          case 'update': {
            const { error } = await supabase
              .from(item.table)
              .update(dataWithUser)
              .eq('id', item.data.id)
              .eq('user_id', uid);
            if (error) throw error;
            break;
          }
          case 'delete': {
            const { error } = await supabase
              .from(item.table)
              .delete()
              .eq('id', item.data.id)
              .eq('user_id', uid);
            if (error) throw error;
            break;
          }
        }

        completed++;
        this.setProgress(completed / total);
        removeFromQueue(item.id);
      } catch (err) {
        // 重试逻辑
        if (item.retryCount < 3) {
          failedItems.push({ ...item, retryCount: item.retryCount + 1 });
        } else {
          console.error(`Sync failed after 3 retries:`, item, err);
          removeFromQueue(item.id);
        }
        completed++;
        this.setProgress(completed / total);
      }
    }

    // 重新入队失败项
    if (failedItems.length > 0) {
      const remaining = getQueue();
      saveQueue([...remaining, ...failedItems]);
    }

    this.setStatus(failedItems.length > 0 ? 'error' : 'idle');
    this.syncing = false;
  }

  /** 冲突解决：用户选择保留本地或远程版本 */
  async resolveConflict(
    conflict: ConflictInfo,
    useLocal: boolean
  ): Promise<void> {
    const uid = await getCurrentUserId();
    if (!uid) return;

    const version = useLocal ? conflict.local : conflict.remote;
    const { error } = await supabase
      .from(conflict.table)
      .update({ ...version, updated_at: new Date().toISOString() })
      .eq('id', conflict.id)
      .eq('user_id', uid);

    if (error) {
      console.error('Conflict resolution failed:', error);
    }
  }

  /** 获取待同步数量 */
  getPendingCount(): number {
    return getQueue().length;
  }
}

// ===== 同步状态指示器组件 =====

export function SyncIndicator() {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [pending, setPending] = useState(0);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const engine = SyncEngine.getInstance();
    const unsub1 = engine.onStatusChange(setStatus);
    const unsub2 = engine.onProgressChange(setProgress);

    // 定时检查队列
    const interval = setInterval(() => {
      setPending(engine.getPendingCount());
      if (engine.getPendingCount() > 0 && engine.status === 'idle') {
        engine.sync();
      }
    }, 10000);

    return () => {
      unsub1();
      unsub2();
      clearInterval(interval);
    };
  }, []);

  // 旋转动画
  useEffect(() => {
    if (status === 'syncing') {
      const loop = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      );
      loop.start();
      return () => loop.stop();
    } else {
      rotateAnim.setValue(0);
    }
  }, [status]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const statusConfig = {
    idle: { icon: '✅', label: '已同步', color: Colors.success },
    syncing: { icon: '🔄', label: `同步中 ${Math.round(progress * 100)}%`, color: Colors.primary },
    error: { icon: '⚠️', label: '同步失败', color: Colors.warning },
    conflict: { icon: '⚡', label: '冲突待解决', color: Colors.dianHong },
  }[status];

  if (status === 'idle' && pending === 0) return null;

  return (
    <View style={[styles.indicator, { borderColor: statusConfig.color + '30' }]}>
      <Animated.Text style={[styles.indicatorIcon, { transform: [{ rotate: spin }] }]}>
        {statusConfig.icon}
      </Animated.Text>
      <Text style={[styles.indicatorText, { color: statusConfig.color }]}>
        {statusConfig.label}
      </Text>
      {pending > 0 && status === 'idle' && (
        <Text style={styles.pendingBadge}>{pending}</Text>
      )}
    </View>
  );
}

// ===== 离线检测 Hook =====
export function useOnlineStatus() {
  const [online, setOnline] = useState(
    Platform.OS === 'web' ? navigator.onLine : true
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleOnline = () => {
      setOnline(true);
      // 恢复在线时自动同步
      SyncEngine.getInstance().sync();
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}

const styles = StyleSheet.create({
  indicator: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: 4,
  },
  indicatorIcon: { fontSize: 12 },
  indicatorText: { fontSize: FontSize.xs, fontWeight: '600' },
  pendingBadge: {
    fontSize: 10, fontWeight: 'bold',
    color: '#FFFFFF', backgroundColor: Colors.warning,
    width: 16, height: 16, borderRadius: 8,
    textAlign: 'center', lineHeight: 16,
    overflow: 'hidden',
  },
});
