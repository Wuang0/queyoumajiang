module.exports = {
  env: {
    NODE_ENV: '"production"',
  },
  defineConstants: {
    'process.env.TARO_APP_API_URL': JSON.stringify(process.env.TARO_APP_API_URL || 'http://localhost:3000'),
    'process.env.TARO_APP_WS_URL': JSON.stringify(process.env.TARO_APP_WS_URL || 'http://localhost:3000'),
  },
  mini: {},
  h5: {
    publicPath: '/',
  },
};
