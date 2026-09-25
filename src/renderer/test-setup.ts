import '@testing-library/jest-dom/vitest'
import './src/i18n'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// `test.globals` fica desligado (docs/09 usa `import` explícito de vitest em
// todo teste), então o auto-cleanup do Testing Library — que só se registra
// sozinho quando `afterEach` é global — precisa ser ligado manualmente aqui.
afterEach(() => {
  cleanup()
})
