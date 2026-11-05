import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const configuredTarget = env.VITE_API_TARGET || env.PROXY_TARGET || 'http://127.0.0.1:3000';
  const targetUrl = new URL(configuredTarget);
  if (!targetUrl.port && env.VITE_API_TARGET_PORT) {
    targetUrl.port = env.VITE_API_TARGET_PORT;
  }
  const target = targetUrl.toString().replace(/\/$/, '') || 'http://127.0.0.1:3000';
  const apiBaseUrl = env.API_BASE_URL || '';
  const tunnelHosts = [
    'https://0078-2409-40f0-849f-b287-5421-be88-4237-dd71.ngrok-free.app',
    '.ngrok-free.app',
    '.ngrok.io',
  ];

  return {
    plugins: [react()],
    define: {
      'import.meta.env.API_BASE_URL': JSON.stringify(apiBaseUrl),
    },
    server: {
      port: 5173,
      host: true,
      allowedHosts: tunnelHosts,
      proxy: {
        '/api': { target, changeOrigin: true },
        '/auth': { target, changeOrigin: true },
        '/api-docs': { target, changeOrigin: true },
      },
    },
    preview: {
      allowedHosts: tunnelHosts,
    },
  };
});
