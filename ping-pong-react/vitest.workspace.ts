export default [
  {
    extends: './vite.config.ts',
    test: { name: 'unit', include: ['src/**/*.test.ts'], environment: 'node' },
  },
  {
    extends: './vite.config.ts',
    test: {
      name: 'browser',
      include: ['src/**/*.browser.test.tsx'],
      browser: { enabled: true, provider: 'playwright', name: 'chromium', headless: true },
    },
  },
]
