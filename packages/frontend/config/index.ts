/**
 * Taro 项目配置
 * 参考: https://taro-docs.jd.com/docs/config
 */

const path = require('path');

const config = {
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
  plugins: [
    '@tarojs/plugin-framework-react',
    '@tarojs/plugin-platform-weapp',
    '@tarojs/plugin-platform-h5',
  ],
  defineConstants: {},
  copy: {
    patterns: [],
    options: {},
  },
  framework: 'react',
  compiler: {
    type: 'webpack5',
  },
  cache: {
    enable: false,
  },

  // 微信小程序
  mini: {
    postcss: {
      pxtransform: {
        enable: true,
        config: {},
      },
      url: {
        enable: true,
        config: {
          limit: 1024,
        },
      },
    },
  },

  // H5 网页
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    router: {
      mode: 'hash',
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

module.exports = function (merge) {
  if (process.env.NODE_ENV === 'development') {
    return merge({}, config, require('./dev'));
  }
  return merge({}, config, require('./prod'));
};
