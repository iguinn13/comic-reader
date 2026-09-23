import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ptBR from './locales/pt-BR.json'

/**
 * Só pt-BR na v1 (RNF-09), mas já passa pelo i18next: nenhum texto de UI deve
 * ficar hardcoded em componente (ver CLAUDE.md e docs/01-requisitos.md RNF-09).
 * Adicionar um novo idioma depois é só criar o arquivo de locale e registrá-lo
 * abaixo, sem tocar nos componentes.
 */
void i18n.use(initReactI18next).init({
  resources: {
    'pt-BR': { translation: ptBR },
  },
  lng: 'pt-BR',
  fallbackLng: 'pt-BR',
  interpolation: { escapeValue: false },
})

export default i18n
