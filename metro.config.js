const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// expo-sqlite uses a WebAssembly binary on web.
config.resolver.assetExts.push('wasm');

// SharedArrayBuffer requires a cross-origin-isolated page.
config.server.enhanceMiddleware = (middleware) => {
  return (request, response, next) => {
    response.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    return middleware(request, response, next);
  };
};

module.exports = config;
