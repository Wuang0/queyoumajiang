export default {
  projectName: '雀友麻将',
  date: '2026-6-17',
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2,
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: [],
  defineConstants: {},
  copy: { patterns: [], options: {} },
  framework: 'react',
  compiler: 'webpack5',
  cache: { enable: false },

  // 微信小程序配置
  mini: {
    postcss: {
      pxtransform: { enable: true, config: {} },
      url: { enable: true, config: { limit: 1024 } },
    },
  },

  // H5 网页配置
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    postcss: {
      autoprefixer: { enable: true, config: {} },
    },
    router: {
      mode: 'hash', // hash 路由，兼容静态部署
      customRoutes: {
        '/pages/login/index': '/pages/login/index',
        '/pages/hall/index': '/pages/hall/index',
        '/pages/room/index': '/pages/room/index',
        '/pages/game/index': '/pages/game/index',
        '/pages/stats/index': '/pages/stats/index',
        '/pages/me/index': '/pages/me/index',
      },
    },
    devServer: {
      port: 10086,
      host: '0.0.0.0',
    },
  },
};
