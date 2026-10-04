import { describe, expect, it } from 'vitest'

import { resolveIrisGvBrowserAdapterBaseUrl } from '@/services/irisAdapterUrl'

describe('resolveIrisGvBrowserAdapterBaseUrl', () => {
  it('routes the official Preview origin only to the Preview Gateway', () => {
    expect(
      resolveIrisGvBrowserAdapterBaseUrl(
        'https://modulo-de-gestao-de-vagas-rh-4d7cd--preview.goskip.app',
      ),
    ).toBe('https://agents.pmaisservicos.com.br/preview/iris-gv')
  })

  it.each([
    'https://vagaspmais.pmaisservicos.com.br',
    'https://modulo-de-gestao-de-vagas-rh-4d7cd.goskip.app',
  ])('routes the exact Production origin %s to the Production Gateway', (origin) => {
    expect(resolveIrisGvBrowserAdapterBaseUrl(origin)).toBe(
      'https://agents.pmaisservicos.com.br/pessoas/iris/gv',
    )
  })

  it.each([
    'https://vagaspmais.pmaisservicos.com.br.evil.example',
    'https://another--preview.goskip.app',
    'http://localhost:5173',
    '',
  ])('fails closed for an unapproved origin %s', (origin) => {
    expect(() => resolveIrisGvBrowserAdapterBaseUrl(origin)).toThrow(
      'IRIS_GV_BROWSER_ORIGIN_NOT_ALLOWED',
    )
  })
})
