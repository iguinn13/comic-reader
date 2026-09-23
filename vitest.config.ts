import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

/**
 * M0 só cobre o essencial: testes do main em ambiente Node puro (ver
 * docs/09-testes-e-qualidade.md §1). Um projeto separado para componentes do
 * renderer (ambiente jsdom) entra quando M3 começa a ter lógica para testar.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@main': resolve('src/main'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/main/**/*.test.ts', 'src/shared/**/*.test.ts'],
  },
})
