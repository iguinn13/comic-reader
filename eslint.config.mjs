import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'
import eslintPluginJsxA11y from 'eslint-plugin-jsx-a11y'

export default defineConfig(
  {
    ignores: [
      '**/node_modules',
      '**/dist',
      '**/out',
      '**/*.config.{js,mjs,ts}',
      // Worktrees de agentes ficam dentro do próprio repo (.claude/worktrees/*)
      // enquanto rodam; não são o código deste checkout.
      '.claude/worktrees',
    ],
  },
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  eslintPluginJsxA11y.flatConfigs.recommended,
  {
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh,
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Tipos do TypeScript já cobrem isto; o eslint-plugin-react não entende
      // genéricos (ex.: React.InputHTMLAttributes) e gera falsos positivos.
      'react/prop-types': 'off',
    },
  },
  {
    // src/shared não pode depender de Node nem do DOM: é importado por main,
    // preload e renderer ao mesmo tempo (docs/02-arquitetura.md §4).
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['electron', 'electron/*', 'node:*'] }],
    },
  },
  {
    // O renderer só fala com o main pela ponte de window.api — nunca importa
    // electron ou módulos do Node diretamente (checklist de segurança em
    // docs/02-arquitetura.md §6).
    files: ['src/renderer/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['electron', 'electron/*', 'node:*', 'fs', 'path', 'child_process'] },
      ],
    },
  },
  eslintConfigPrettier,
)
