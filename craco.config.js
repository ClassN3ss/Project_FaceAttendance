module.exports = {
    webpack: {
      configure: (webpackConfig) => {
        webpackConfig.resolve.fallback = {
          fs: false,
          path: false,
          os: false,
        };
        return webpackConfig;
      },
    },
  };
  