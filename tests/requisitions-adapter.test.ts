import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/pocketbase/client', () => ({
  default: {
    authStore: { token: 'user-session-token' },
  },
}))

import { irisBrowserAdapterRequest } from '@/services/requisitions'

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

    await irisBrowserAdapterRequest('/v1/example', { example: true }, 'https://vagaspmais.pmaisservicos.com.br')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://agents.pmaisservicos.com.br/pessoas/iris/gv/v1/example',
    )
  })

  it('rejects an unknown origin before fetch is called', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      irisBrowserAdapterRequest('/v1/example', {}, 'https://vagaspmais.pmaisservicos.com.br.evil.example'),
    ).rejects.toThrow('IRIS_GV_BROWSER_ORIGIN_NOT_ALLOWED')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
