import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    projects: [
      {
        resolve: {
          alias: {
            '@shared': resolve('src/shared'),
            '@main': resolve('src/main'),
          },
        },
        test: {
          name: 'main',
          environment: 'node',
          include: ['src/main/**/*.test.ts', 'src/shared/**/*.test.ts'],
        },
      },
      {
        plugins: [react()],
        resolve: {
          alias: {
            '@shared': resolve('src/shared'),
            '@renderer': resolve('src/renderer/src'),
          },
        },
        test: {
          name: 'renderer',
          environment: 'jsdom',
          setupFiles: ['src/renderer/test-setup.ts'],
          include: ['src/renderer/**/*.test.{ts,tsx}'],
        },
      },
    ],
  },
})
