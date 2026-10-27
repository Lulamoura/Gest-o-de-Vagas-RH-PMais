import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/pocketbase/client', () => ({
  default: {
    authStore: { token: 'user-session-token' },
  },
}))

import {
  IrisBrowserAdapterError,
  createManualContingencyWordpressDraft,
  getIrisOperationalStatus,
  irisBrowserAdapterRequest,
  isIrisHermesUnavailableSuggestionError,
} from '@/services/requisitions'

const productionOrigin = 'https://vagaspmais.pmaisservicos.com.br'
const adapterBase = 'https://agents.pmaisservicos.com.br/pessoas/iris/gv'

describe('irisBrowserAdapterRequest environment boundary', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('builds the final Production request URL only for an exact Production origin', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await irisBrowserAdapterRequest('/v1/example', { example: true }, productionOrigin)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(`${adapterBase}/v1/example`)
  })

  it('rejects an unknown origin before fetch is called', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      irisBrowserAdapterRequest(
        '/v1/example',
        {},
        'https://vagaspmais.pmaisservicos.com.br.evil.example',
      ),
    ).rejects.toThrow('IRIS_GV_BROWSER_ORIGIN_NOT_ALLOWED')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('Íris operational continuity service contracts', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('window', { location: { origin: productionOrigin } })
  })

  it('gets the authenticated operational status without sending a request body', async () => {
    const response = {
      status: 'UNAVAILABLE',
      manual_contingency_allowed: true,
      last_successful_check_at: '2026-10-27T11:30:00.000Z',
    }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => response })
    vi.stubGlobal('fetch', fetchMock)

    await expect(getIrisOperationalStatus()).resolves.toEqual(response)

    expect(fetchMock).toHaveBeenCalledWith(
      `${adapterBase}/v1/pessoas/iris/gv-rh/browser/operational-status`,
      {
        method: 'GET',
        headers: { Authorization: 'Bearer user-session-token' },
      },
    )
  })

  it('posts only the exact reviewed manual publication fields and explicit confirmation', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        duplicate: false,
        verified: true,
        post_status: 'draft',
        wordpress_job_id: '42',
        wordpress_admin_url: 'https://wordpress.example/wp-admin/post.php?post=42&action=edit',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const payload = {
      titulo_publico: '  Título exatamente revisado  ',
      descricao_publica: '\n<p>Descrição exatamente revisada</p>\n',
      perfil_interno_triagem: '  Perfil interno exatamente revisado\n',
      confirmacao_explicita: true as const,
    }
    const suppliedPayload = {
      ...payload,
      actor_id: 'must-not-leave-the-browser',
      profile: 'admin',
      status: 'UNAVAILABLE',
      suggestion_proof: { signature: 'must-not-leave-the-browser' },
      secret: 'must-not-leave-the-browser',
    }

    await createManualContingencyWordpressDraft('req / 123', suppliedPayload)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(
      `${adapterBase}/v1/pessoas/iris/gv-rh/browser/requisitions/req%20%2F%20123/wordpress-draft-manual`,
    )
    expect(init).toEqual({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer user-session-token',
      },
      body: JSON.stringify({ publicacao_manual: payload }),
    })
    expect(Object.keys(JSON.parse(init.body).publicacao_manual)).toEqual([
      'titulo_publico',
      'descricao_publica',
      'perfil_interno_triagem',
      'confirmacao_explicita',
    ])
    expect(init.body).not.toContain('proof')
    expect(init.body).not.toContain('actor')
    expect(init.body).not.toContain('profile')
    expect(init.body).not.toContain('status')
    expect(init.body).not.toContain('secret')
  })

  it('preserves the controlled adapter code and HTTP status in a typed error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({
          detail: {
            code: 'IRIS_HERMES_UNAVAILABLE',
            message: 'A Íris está temporariamente indisponível.',
          },
        }),
      }),
    )

    const error = await irisBrowserAdapterRequest('/v1/example', {}, productionOrigin).catch(
      (reason) => reason,
    )

    expect(error).toBeInstanceOf(IrisBrowserAdapterError)
    expect(error).toMatchObject({
      code: 'IRIS_HERMES_UNAVAILABLE',
      status: 503,
      message: 'A Íris está temporariamente indisponível.',
    })
    expect(isIrisHermesUnavailableSuggestionError(error)).toBe(true)
  })

  it('classifies only the exact controlled adapter error as Hermes unavailability', () => {
    expect(
      isIrisHermesUnavailableSuggestionError(
        new IrisBrowserAdapterError(
          'A Íris está temporariamente indisponível.',
          'IRIS_HERMES_UNAVAILABLE',
          503,
        ),
      ),
    ).toBe(true)
    expect(
      isIrisHermesUnavailableSuggestionError(
        new IrisBrowserAdapterError('Conteúdo inválido.', 'IRIS_CONTENT_INVALID', 422),
      ),
    ).toBe(false)
    expect(isIrisHermesUnavailableSuggestionError(new Error('IRIS_HERMES_UNAVAILABLE'))).toBe(
      false,
    )
    expect(
      isIrisHermesUnavailableSuggestionError({
        code: 'IRIS_HERMES_UNAVAILABLE',
        status: 503,
      }),
    ).toBe(false)
  })
})
