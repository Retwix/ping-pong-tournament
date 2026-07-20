// Mutation testing (see CLAUDE.md workflow). Scope with --mutate for
// branch work, e.g.: npx stryker run --mutate src/lib/spectator.ts
export default {
  testRunner: 'vitest',
  coverageAnalysis: 'perTest',
  reporters: ['clear-text', 'progress'],
  mutate: [
    'src/lib/**/*.ts',
    '!src/lib/**/*.test.ts',
  ],
}
