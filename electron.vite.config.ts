import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// Aliases: @shared é compartilhado por main, preload e renderer (ver docs/02-arquitetura.md §4).
const sharedAlias = { '@shared': resolve('src/shared') }

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin(),
      // As migrations SQL do drizzle-kit não são código — o esbuild não as
      // enxerga a partir de `client.ts`. Copiamos a pasta para dentro de
      // out/main/ (junto do index.js bundlado) tanto em dev quanto no build
      // de produção, para `join(__dirname, 'migrations')` (src/main/db/client.ts)
      // funcionar nos dois casos sem precisar de `extraResources` no
      // electron-builder (docs/03-modelo-de-dados.md §4).
      viteStaticCopy({
        // O main é buildado como o ambiente "ssr" do Vite (não "client", o
        // default do plugin) — sem isto, a cópia é silenciosamente pulada.
        environment: 'ssr',
        targets: [
          {
            src: 'src/main/db/migrations',
            dest: '.',
            // Sem isto, a estrutura de pastas de origem inteira (src/main/db/…)
            // seria preservada dentro de out/main/ — stripBase:3 remove os 3
            // segmentos antes de "migrations" (src, main, db).
            rename: { stripBase: 3 },
          },
        ],
      }),
    ],
    resolve: {
      alias: {
        ...sharedAlias,
        '@main': resolve('src/main'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: sharedAlias,
    },
  },
  renderer: {
    resolve: {
      alias: {
        ...sharedAlias,
        '@renderer': resolve('src/renderer/src'),
      },
    },
    plugins: [react(), tailwindcss()],
  },
})
