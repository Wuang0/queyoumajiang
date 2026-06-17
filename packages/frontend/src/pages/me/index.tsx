import { View, Text } from '@tarojs/components';
import { useAuthStore } from '../../store/auth.store';

export default function MePage() {
  const user = useAuthStore((s) => s.user);

  return (
    <View style={{ padding: 40 }}>
      <Text style={{ fontSize: '36px', fontWeight: 700 }}>
        {user?.nickname ?? '雀友'}
      </Text>
      <Text style={{ display: 'block', marginTop: 16, color: '#9AA5B1' }}>
        段位：雀友 · {user?.rankLevel ?? 1} 段
      </Text>
      <Text style={{ display: 'block', marginTop: 8, color: '#9AA5B1' }}>
        总对局：{user?.totalMatches ?? 0} 局
      </Text>
    </View>
  );
}
