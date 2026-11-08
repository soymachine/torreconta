import { defineConfig } from 'vitest/config'

// Tests de reglas de seguridad: requieren el emulador de Firestore
// (se lanzan con `npm run test:rules`).
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.ts'],
    testTimeout: 20000,
    fileParallelism: false,
  },
})
