import { useState } from 'react';
import { View, Text, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { authApi } from '../../services/api';
import { useAuthStore } from '../../store/auth.store';
import './index.css';

export default function LoginPage() {
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const { guestId, login } = useAuthStore();

  const handleLogin = async () => {
    const displayName = nickname.trim() || `雀友${Math.floor(1000 + Math.random() * 9000)}`;

    setLoading(true);
    try {
      const data = await authApi.login(guestId!, displayName);
      login(data.token, data.refreshToken, {
        id: data.user.id,
        guestId: guestId!,
        nickname: data.user.nickname,
        avatarUrl: data.user.avatarUrl,
        rankLevel: data.user.rankLevel,
        rankScore: data.user.rankScore,
        totalMatches: data.user.totalMatches,
        totalWins: data.user.totalWins,
      });

      // 跳转到大厅
      Taro.switchTab({ url: '/pages/hall/index' });
    } catch (e) {
      console.error('登录失败', e);
      Taro.showToast({ title: '登录失败，请检查网络后重试', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className='login-page'>
      <View className='login-brand'>
        <View className='login-logo'>雀</View>
        <Text className='login-name'>雀友麻将</Text>
        <Text className='login-tagline'>朋友局 · 缺一门红中癞子</Text>
      </View>

      <View className='login-form'>
        <Input
          className='login-nickname-input'
          value={nickname}
          onInput={(e) => setNickname(e.detail.value)}
          maxlength={12}
          placeholder='输入你的昵称'
          placeholderStyle='color:#9AA5B1'
          onConfirm={handleLogin}
        />
        <View
          className={`login-btn ${loading ? 'loading' : ''}`}
          onClick={handleLogin}
        >
          {loading ? '进入中...' : '进入游戏'}
        </View>
        <Text className='login-hint'>
          {nickname.trim() ? '' : '不填也没关系，系统会随机生成昵称'}
        </Text>
      </View>
    </View>
  );
}
