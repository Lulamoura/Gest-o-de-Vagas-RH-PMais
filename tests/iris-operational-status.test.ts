import { describe, expect, it } from 'vitest'
import {
  buildIrisReviewedPublication,
  canUseManualContingency,
  getIrisOperationalStatusView,
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
