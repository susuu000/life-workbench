import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, FontSize, BorderRadius } from '@/lib/theme';
import { MODULE_META, type ModuleKey } from '@/lib/types';
import EnglishDetail from '@/components/EnglishDetail';
import AIDetail from '@/components/AIDetail';
import ReadingDetail from '@/components/ReadingDetail';
import PodcastDetail from '@/components/PodcastDetail';
import SocialMediaDetail from '@/components/SocialMediaDetail';
import SelfExploreDetail from '@/components/SelfExploreDetail';

/**
 * 板块详情页（动态路由）
 * 路径: /(tabs)/module/[key]
 * 根据模块 key 渲染对应的详情组件
 */
export default function ModuleDetailScreen() {
  const params = useLocalSearchParams();
  const key = (params.key as string) ?? 'english';
  const moduleKey = key as ModuleKey;
  const insets = useSafeAreaInsets();
  const meta = MODULE_META[moduleKey] ?? { label: '未知', icon: '❓' };

  // 根据模块 key 渲染不同内容
  const renderContent = () => {
    switch (moduleKey) {
      case 'english':
        return <EnglishDetail />;
      case 'ai_learning':
        return <AIDetail />;
      case 'reading':
        return <ReadingDetail />;
      case 'podcast':
        return <PodcastDetail />;
      case 'social_media':
        return <SocialMediaDetail />;
      case 'self_explore':
        return <SelfExploreDetail />;
      default:
        return <PlaceholderDetail icon={meta.icon} label={meta.label} desc="开发中…" />;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 固定头部 */}
      <View style={styles.header}>
        <Text style={styles.headerIcon}>{meta.icon}</Text>
        <Text style={styles.headerTitle}>{meta.label}</Text>
      </View>

      {/* 板块内容区 */}
      {renderContent()}
    </View>
  );
}

/** 占位详情（用于尚未实现的板块） */
function PlaceholderDetail({ icon, label, desc }: { icon: string; label: string; desc: string }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderIcon}>{icon}</Text>
      <Text style={styles.placeholderLabel}>{label}</Text>
      <Text style={styles.placeholderDesc}>{desc}</Text>
      <View style={styles.placeholderBox}>
        <Text style={styles.placeholderText}>🚧 该板块正在开发中</Text>
        <Text style={styles.placeholderSub}>即将包含完整功能与数据同步</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  headerIcon: { fontSize: 28 },
  headerTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.textPrimary },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl },
  placeholderIcon: { fontSize: 48, marginBottom: Spacing.md },
  placeholderLabel: { fontSize: FontSize.xxl, fontWeight: 'bold', color: Colors.primary, marginBottom: Spacing.sm },
  placeholderDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xl },
  placeholderBox: {
    width: '80%',
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  placeholderText: { fontSize: FontSize.lg, color: Colors.textSecondary, marginBottom: Spacing.sm },
  placeholderSub: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
});
