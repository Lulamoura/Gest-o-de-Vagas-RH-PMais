const IRIS_GV_PREVIEW_ORIGINS = new Set([
  'https://modulo-de-gestao-de-vagas-rh-4d7cd--preview.goskip.app',
])

const IRIS_GV_PRODUCTION_ORIGINS = new Set([
  'https://vagaspmais.pmaisservicos.com.br',
  'https://modulo-de-gestao-de-vagas-rh-4d7cd.goskip.app',
])

const IRIS_GV_PREVIEW_GATEWAY = 'https://agents.pmaisservicos.com.br/preview/iris-gv'
const IRIS_GV_PRODUCTION_GATEWAY = 'https://agents.pmaisservicos.com.br/pessoas/iris/gv'

export const resolveIrisGvBrowserAdapterBaseUrl = (origin: string): string => {
  if (IRIS_GV_PREVIEW_ORIGINS.has(origin)) {
    return IRIS_GV_PREVIEW_GATEWAY
  }
  if (IRIS_GV_PRODUCTION_ORIGINS.has(origin)) {
    return IRIS_GV_PRODUCTION_GATEWAY
  }
  throw new Error('IRIS_GV_BROWSER_ORIGIN_NOT_ALLOWED')
}
