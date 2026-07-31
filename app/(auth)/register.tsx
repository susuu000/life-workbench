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

/** 注册页：邮箱 + 密码 + 确认密码 */
export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRegister() {
    setError('');
    if (!email.trim()) { setError('请输入邮箱'); return; }
    if (password.length < 6) { setError('密码至少6位'); return; }
    if (password !== confirmPwd) { setError('两次密码不一致'); return; }

    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { display_name: 'Susu' },
        },
      });
      if (authError) {
        if (authError.message.includes('already registered')) {
          setError('该邮箱已注册，请直接登录');
        } else {
          setError(authError.message);
        }
        return;
      }
      // 注册成功 → 提示后跳转登录
      Alert.alert(
        '注册成功',
        '账号已创建，请登录',
        [{ text: '去登录', onPress: () => router.replace('/(auth)/login') }]
      );
    } catch {
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
        <Text style={styles.brandName}>注册 Susu</Text>
        <Text style={styles.brandSub}>创建你的生活工作台</Text>
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
          placeholder="密码（至少6位）"
          placeholderTextColor={Colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="确认密码"
          placeholderTextColor={Colors.textMuted}
          secureTextEntry
          value={confirmPwd}
          onChangeText={setConfirmPwd}
          editable={!loading}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Text style={styles.btnText}>注 册</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* 登录入口 */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>已有账号？</Text>
        <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.link}>立即登录</Text>
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
    marginTop: Spacing.xxxl * 1.2,
    marginBottom: Spacing.xl,
  },
  brandIcon: { fontSize: 48 },
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
