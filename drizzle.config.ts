import { defineConfig } from 'drizzle-kit'

// Gera as migrations de src/main/db/schema.ts (docs/03-modelo-de-dados.md §4).
export default defineConfig({
  schema: './src/main/db/schema.ts',
  out: './src/main/db/migrations',
  dialect: 'sqlite',
})
