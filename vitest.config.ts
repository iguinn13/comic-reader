import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/**
 * Dois projetos (docs/09-testes-e-qualidade.md §1): `main`, em Node puro
 * (serviços, repositórios, archives), e `renderer`, em jsdom + Testing
 * Library, para componentes com lógica de verdade (ComicCard, toolbars…),
 * que passou a existir a partir de M3 (docs/08-plano-de-implementacao.md).
 */
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
