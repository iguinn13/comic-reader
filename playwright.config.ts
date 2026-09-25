import { defineConfig } from '@playwright/test'

/** E2E com Playwright + Electron (docs/09-testes-e-qualidade.md §2.3). Roda sobre o build em `out/`. */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  workers: 1,
  reporter: 'list',
})
