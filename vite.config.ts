import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const timerEnv = env.VITE_TIMER_ENV || mode;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '~': path.resolve(__dirname, 'src'),
      },
    },
    build: {
      outDir: `${timerEnv}`,
      chunkSizeWarningLimit: 1500, // 🔥 기본 500kB → 1.5MB로 올림
    },
  };
});
