import { describe, expect, it, vi } from 'vitest'
import { IrisBrowserAdapterError } from '@/services/requisitions'
import {
  buildIrisReviewedPublication,
  canRequestIrisSuggestion,
  canUseManualContingency,
  getIrisOperationalStatusView,
  reconcileIrisUnavailableAlert,
  refreshIrisStatusAfterUnavailableSuggestionError,
  shouldLoadIrisOperationalStatus,
} from '@/lib/iris-operational-status'

describe('Íris operational status business view', () => {
  it.each([
    ['HEALTHY', 'Disponível'],
    ['DEGRADED', 'Atenção'],
    ['UNAVAILABLE', 'Indisponível'],
    ['UNKNOWN', 'Estado não confirmado'],
  ] as const)('maps %s to %s', (status, label) => {
    expect(
      getIrisOperationalStatusView({
        status,
        manual_contingency_allowed: status === 'UNAVAILABLE',
        last_successful_check_at: '2026-10-27T11:30:00.000Z',
      }).label,
    ).toBe(label)
  })

  it('allows the manual action only for confirmed unavailability with the server flag', () => {
    expect(
      getIrisOperationalStatusView({
        status: 'UNAVAILABLE',
        manual_contingency_allowed: false,
        last_successful_check_at: null,
      }).showManualAction,
    ).toBe(false)
    expect(
      getIrisOperationalStatusView({
        status: 'UNKNOWN',
        manual_contingency_allowed: true,
        last_successful_check_at: null,
      }).showManualAction,
    ).toBe(false)
    expect(
      getIrisOperationalStatusView({
        status: 'UNAVAILABLE',
        manual_contingency_allowed: true,
        last_successful_check_at: null,
      }).showManualAction,
    ).toBe(true)
  })

  it('loads status only for approved requisitions managed by RH or admin', () => {
    expect(shouldLoadIrisOperationalStatus('Aprovada', true)).toBe(true)
    expect(shouldLoadIrisOperationalStatus('Aprovada', false)).toBe(false)
    expect(shouldLoadIrisOperationalStatus('Rascunho', true)).toBe(false)
  })

  it('enables suggestion only for a loaded healthy or degraded status', () => {
    const status = (value: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'UNKNOWN') => ({
      status: value,
      manual_contingency_allowed: false,
      last_successful_check_at: null,
    })

    expect(canRequestIrisSuggestion(status('HEALTHY'), false)).toBe(true)
    expect(canRequestIrisSuggestion(status('DEGRADED'), false)).toBe(true)
    expect(canRequestIrisSuggestion(status('UNAVAILABLE'), false)).toBe(false)
    expect(canRequestIrisSuggestion(status('UNKNOWN'), false)).toBe(false)
    expect(canRequestIrisSuggestion(null, false)).toBe(false)
    expect(canRequestIrisSuggestion(status('HEALTHY'), true)).toBe(false)
  })

  it('refreshes status exactly once only for the exact Hermes unavailability error', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined)
    const unavailableError = new IrisBrowserAdapterError(
      'A Íris está temporariamente indisponível.',
      'IRIS_HERMES_UNAVAILABLE',
      503,
    )

    await expect(
      refreshIrisStatusAfterUnavailableSuggestionError(unavailableError, refresh),
    ).resolves.toBe(true)
    expect(refresh).toHaveBeenCalledTimes(1)

    refresh.mockClear()
    await expect(
      refreshIrisStatusAfterUnavailableSuggestionError(
        new IrisBrowserAdapterError('Conteúdo inválido.', 'IRIS_CONTENT_INVALID', 422),
        refresh,
      ),
    ).resolves.toBe(false)
    await expect(
      refreshIrisStatusAfterUnavailableSuggestionError(
        new Error('IRIS_HERMES_UNAVAILABLE'),
        refresh,
      ),
    ).resolves.toBe(false)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('keeps the incident alert until a confirmed healthy status recovers', () => {
    const status = (value: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'UNKNOWN') => ({
      status: value,
      manual_contingency_allowed: value === 'UNAVAILABLE',
      last_successful_check_at: null,
    })

    expect(reconcileIrisUnavailableAlert(true, status('UNAVAILABLE'))).toBe(true)
    expect(reconcileIrisUnavailableAlert(true, status('UNKNOWN'))).toBe(true)
    expect(reconcileIrisUnavailableAlert(true, status('DEGRADED'))).toBe(true)
    expect(reconcileIrisUnavailableAlert(true, status('HEALTHY'))).toBe(false)
    expect(reconcileIrisUnavailableAlert(false, status('UNAVAILABLE'))).toBe(false)
  })

  it('fails closed before manual submission when authorization, requisition, or status changed', () => {
    const unavailable = {
      status: 'UNAVAILABLE' as const,
      manual_contingency_allowed: true,
      last_successful_check_at: null,
    }

    expect(canUseManualContingency('Aprovada', true, unavailable)).toBe(true)
    expect(canUseManualContingency('Aprovada', false, unavailable)).toBe(false)
    expect(canUseManualContingency('Cancelada', true, unavailable)).toBe(false)
    expect(
      canUseManualContingency('Aprovada', true, {
        ...unavailable,
        status: 'HEALTHY',
      }),
    ).toBe(false)
    expect(canUseManualContingency('Aprovada', true, null)).toBe(false)
  })

  it('preserves the three reviewed fields byte for byte in the normal payload', () => {
    const payload = buildIrisReviewedPublication({
      title: '  Título\n',
      publicDescription: '\n<p>Descrição</p>  ',
      internalProfile: '\tPerfil interno\n',
      suggestionProof: { request_id: 'proof' },
    })

    expect(payload.titulo_publico_iris).toBe('  Título\n')
    expect(payload.descricao_publica_iris).toBe('\n<p>Descrição</p>  ')
    expect(payload.perfil_interno_triagem_iris).toBe('\tPerfil interno\n')
  })

  it('uses friendly text for the last successful check and hides invalid dates', () => {
    const view = getIrisOperationalStatusView({
      status: 'DEGRADED',
      manual_contingency_allowed: false,
      last_successful_check_at: '2026-10-27T11:30:00.000Z',
    })
    expect(view.lastSuccessfulCheckLabel).toMatch(/^Última verificação bem-sucedida:/)
    expect(view.lastSuccessfulCheckLabel).not.toContain('2026-10-27T11:30:00.000Z')

    expect(
      getIrisOperationalStatusView({
        status: 'UNKNOWN',
        manual_contingency_allowed: false,
        last_successful_check_at: 'not-a-date',
      }).lastSuccessfulCheckLabel,
    ).toBeNull()
  })
})
