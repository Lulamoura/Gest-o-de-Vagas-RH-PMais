// @vitest-environment jsdom

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getRequisition: vi.fn(),
  getIrisOperationalStatus: vi.fn(),
  suggestRequisitionJobDescription: vi.fn(),
  createManualContingencyWordpressDraft: vi.fn(),
  getChangeRequests: vi.fn(),
}))

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', profile: 'admin', expand: {} },
  }),
}))
vi.mock('@/hooks/use-realtime', () => ({ useRealtime: () => undefined }))
vi.mock('@/services/requisitions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/requisitions')>()
  return {
    ...actual,
    getRequisition: mocks.getRequisition,
    getIrisOperationalStatus: mocks.getIrisOperationalStatus,
    suggestRequisitionJobDescription: mocks.suggestRequisitionJobDescription,
    createManualContingencyWordpressDraft: mocks.createManualContingencyWordpressDraft,
    changeRequisitionStatus: vi.fn(),
    deleteRequisition: vi.fn(),
    createWordpressDraft: vi.fn(),
    updateRequisition: vi.fn(),
  }
})
vi.mock('@/services/requisition_change_requests', () => ({
  getChangeRequests: mocks.getChangeRequests,
}))
vi.mock('@/components/ChangeRequestDialog', () => ({ ChangeRequestDialog: () => null }))
vi.mock('@/components/RichTextEditor', () => ({ RichTextEditor: () => null }))
vi.mock('@/components/RequisitionChangeRequests', () => ({ RequisitionChangeRequests: () => null }))
vi.mock('@/components/RequisitionHistory', () => ({ RequisitionHistory: () => null }))
vi.mock('@/components/RequisitionComments', () => ({ RequisitionComments: () => null }))
vi.mock('@/components/RequisitionAttachments', () => ({ RequisitionAttachments: () => null }))
vi.mock('@/components/ConfirmDialog', () => ({ ConfirmDialog: () => null }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { IrisBrowserAdapterError } from '@/services/requisitions'
import RequisitionDetail from '@/pages/RequisitionDetail'

const flush = async () => {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

const findButton = (container: HTMLElement, text: string) =>
  Array.from(container.querySelectorAll('button')).find((button) =>
    button.textContent?.includes(text),
  )

describe('RequisitionDetail Íris failure-to-contingency flow', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    mocks.getRequisition.mockResolvedValue({
      id: 'req-1',
      status: 'Aprovada',
      quantidade_vagas: 1,
      prioridade: 'Normal',
      expand: {
        cliente: { nome: 'Atrio Hoteis' },
        cargo: { nome: 'Jardineiro' },
      },
    })
    mocks.getChangeRequests.mockResolvedValue([])
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.useRealTimers()
  })

  it('ignores stale polling, disables suggestion, shows the alert and exposes only the manual action', async () => {
    let resolveStaleStatus!: (status: {
      status: 'HEALTHY'
      manual_contingency_allowed: false
      last_successful_check_at: null
    }) => void
    const staleStatus = new Promise<{
      status: 'HEALTHY'
      manual_contingency_allowed: false
      last_successful_check_at: null
    }>((resolve) => {
      resolveStaleStatus = resolve
    })
    mocks.getIrisOperationalStatus
      .mockResolvedValueOnce({
        status: 'HEALTHY',
        manual_contingency_allowed: false,
        last_successful_check_at: null,
      })
      .mockImplementationOnce(() => staleStatus)
      .mockResolvedValueOnce({
        status: 'UNAVAILABLE',
        manual_contingency_allowed: true,
        last_successful_check_at: null,
      })
    let rejectSuggestion!: (error: unknown) => void
    const suggestionFailure = new Promise<never>((_resolve, reject) => {
      rejectSuggestion = reject
    })
    mocks.suggestRequisitionJobDescription.mockImplementation(() => suggestionFailure)

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/requisicoes/req-1']}>
          <Routes>
            <Route path="/requisicoes/:id" element={<RequisitionDetail />} />
          </Routes>
        </MemoryRouter>,
      )
    })
    await flush()

    const suggest = findButton(container, 'Sugerir descrição com Íris')
    expect(suggest).toBeDefined()
    expect(suggest?.disabled).toBe(false)

    await act(async () => {
      suggest?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(mocks.suggestRequisitionJobDescription).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(mocks.getIrisOperationalStatus).toHaveBeenCalledTimes(2)

    await act(async () => {
      rejectSuggestion(
        new IrisBrowserAdapterError(
          'A Íris está temporariamente indisponível.',
          'IRIS_HERMES_UNAVAILABLE',
          502,
        ),
      )
    })
    await flush()

    expect(mocks.getIrisOperationalStatus).toHaveBeenCalledTimes(3)
    expect(container.textContent).toContain(
      'Não foi possível gerar a descrição com a Íris. O modo de Contingência Manual foi disponibilizado para o RH.',
    )
    expect(findButton(container, 'Sugerir descrição com Íris')?.disabled).toBe(true)
    expect(findButton(container, 'Criar rascunho manual em contingência')).toBeDefined()
    expect(container.textContent).not.toContain('Rascunho manual durante a contingência')
    expect(mocks.createManualContingencyWordpressDraft).not.toHaveBeenCalled()

    await act(async () => {
      resolveStaleStatus({
        status: 'HEALTHY',
        manual_contingency_allowed: false,
        last_successful_check_at: null,
      })
    })
    await flush()

    expect(container.textContent).toContain('Estado operacional da Íris: Indisponível')
    expect(findButton(container, 'Criar rascunho manual em contingência')).toBeDefined()
    expect(mocks.createManualContingencyWordpressDraft).not.toHaveBeenCalled()
  })

  it('keeps the business alert and manual action after reloading an unavailable status', async () => {
    mocks.getIrisOperationalStatus.mockResolvedValue({
      status: 'UNAVAILABLE',
      manual_contingency_allowed: true,
      last_successful_check_at: null,
    })

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/requisicoes/req-1']}>
          <Routes>
            <Route path="/requisicoes/:id" element={<RequisitionDetail />} />
          </Routes>
        </MemoryRouter>,
      )
    })
    await flush()

    expect(container.textContent).toContain(
      'Não foi possível gerar a descrição com a Íris. O modo de Contingência Manual foi disponibilizado para o RH.',
    )
    expect(findButton(container, 'Sugerir descrição com Íris')?.disabled).toBe(true)
    expect(findButton(container, 'Criar rascunho manual em contingência')).toBeDefined()
    expect(mocks.createManualContingencyWordpressDraft).not.toHaveBeenCalled()
  })
})
