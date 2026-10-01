import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Shown at the bottom of the home page, to tell which build a device runs.
  define: {
    __BUILD_SHA__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA ?? ''),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
})
