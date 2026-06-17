import { View, Text } from '@tarojs/components';

/** 麻将牌面组件 */
export function MahjongTile({
  tile,
  size = 'normal',
  faceDown = false,
  isWild = false,
  selected = false,
  onClick,
}: {
  tile: string;
  size?: 'small' | 'normal' | 'large';
  faceDown?: boolean;
  isWild?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  const sizeMap = { small: 36, normal: 52, large: 72 };
  const wh = sizeMap[size];

  const isRed = tile === '5z' || tile.startsWith('5') || tile[0] === '5';

  return (
    <View
      style={{
        width: `${wh}rpx`,
        height: `${Math.round(wh * 1.4)}rpx`,
        background: faceDown
          ? 'linear-gradient(160deg, #4F8E5C, #1F5A2D)'
          : 'linear-gradient(170deg, #FBF7EE, #E8DFCE)',
        borderRadius: '6rpx',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...(isWild && !selected ? { boxShadow: '0 0 12px rgba(196,56,46,0.45)' } : {}),
        boxShadow: selected
          ? '0 2px 0 #D8CFB8, 0 8px 16px rgba(31,41,51,0.18), 0 0 0 2px #C4382E'
          : isWild
            ? '0 0 12px rgba(196,56,46,0.45)'
            : '0 2px 0 #D8CFB8, 0 4px 8px rgba(31,41,51,0.08)',
        margin: '2rpx',
        transition: 'transform 0.1s',
        ...(selected ? { transform: 'translateY(-8rpx)' } : {}),
      }}
      onClick={onClick}
    >
      {!faceDown && (
        <Text
          style={{
            fontSize: size === 'large' ? '36rpx' : '26rpx',
            fontWeight: 600,
            color: isRed ? '#C4382E' : '#1F2933',
            fontFamily: '"STKaiti",serif',
          }}
        >
          {tile}
        </Text>
      )}
    </View>
  );
}
