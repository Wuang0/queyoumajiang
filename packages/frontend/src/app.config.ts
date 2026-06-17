export default defineAppConfig({
  pages: [
    'pages/login/index',
    'pages/hall/index',
    'pages/room/index',
    'pages/game/index',
    'pages/stats/index',
    'pages/me/index',
  ],
  window: {
    navigationStyle: 'custom',
    backgroundTextStyle: 'dark',
    backgroundColor: '#F4EFE6',
  },
  tabBar: {
    color: '#9AA5B1',
    selectedColor: '#2B7A3D',
    backgroundColor: '#F4EFE6',
    borderStyle: 'white',
    list: [
      { pagePath: 'pages/hall/index', text: '大厅', iconPath: '', selectedIconPath: '' },
      { pagePath: 'pages/stats/index', text: '战绩', iconPath: '', selectedIconPath: '' },
    ],
  },
});
