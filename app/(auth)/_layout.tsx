import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { Colors } from '@/lib/theme';

/**
 * 认证页面布局：登录/注册页共用，无底部导航栏
 */
export default function AuthLayout() {
  return (
    <>
      <StatusBar style="light" backgroundColor={Colors.primary} />
      <View style={styles.container}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.background },
          }}
        >
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
        </Stack>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
