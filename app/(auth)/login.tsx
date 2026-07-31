import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, FontSize, BorderRadius } from '@/lib/theme';

/** 登录页：邮箱 + 密码登录 */
export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    setError('');
    if (!email.trim()) { setError('请输入邮箱'); return; }
    if (!password) { setError('请输入密码'); return; }

    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (authError) {
        setError(authError.message === 'Invalid login credentials'
          ? '邮箱或密码错误' : authError.message);
        return;
      }
      // 登录成功 → expo-router 自动处理路由
    } catch (e: any) {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* 品牌 */}
      <View style={styles.brand}>
        <Text style={styles.brandIcon}>🌙</Text>
        <Text style={styles.brandName}>Susu</Text>
        <Text style={styles.brandSub}>生活工作台</Text>
      </View>

      {/* 表单 */}
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="邮箱"
          placeholderTextColor={Colors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="密码"
          placeholderTextColor={Colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!loading}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Text style={styles.btnText}>登 录</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* 注册入口 */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>还没有账号？</Text>
        <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
          <Text style={styles.link}>立即注册</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xxl,
  },
  brand: {
    alignItems: 'center',
    marginTop: Spacing.xxxl * 1.5,
    marginBottom: Spacing.xxxl,
  },
  brandIcon: { fontSize: 56 },
  brandName: {
    fontSize: FontSize.xxl,
    fontWeight: 'bold',
    color: Colors.primary,
    marginTop: Spacing.sm,
  },
  brandSub: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  form: { gap: Spacing.md },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  error: {
    color: Colors.error,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    color: '#FFFFFF',
    fontSize: FontSize.md,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: 'auto',
    marginBottom: Spacing.xxl,
  },
  footerText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  link: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
});
