import { describe, expect, it } from 'vitest'
import { formatRequisitionHistoryObservation } from '@/components/RequisitionHistory'

const hashes = {
  titulo_sha256: 'a'.repeat(64),
  descricao_publica_sha256: 'b'.repeat(64),
  perfil_interno_sha256: 'c'.repeat(64),
}

describe('requisition history audit formatter', () => {
  it('translates the recognized normal Íris draft audit without exposing technical data', () => {
    const observation = JSON.stringify({
      schema_version: 'pmais_gv_wordpress_draft_audit_v2',
      operation_marker: '1'.repeat(64),
      actor_id: 'actor-technical-id',
      proof_request_id: 'request-technical-id',
      second_brain_version: 'people-v7',
      second_brain_sha256: 'd'.repeat(64),
      source_fingerprint: 'e'.repeat(64),
      reviewed_field_hashes: hashes,
      wordpress_job_id: '76001',
      wordpress_admin_url: 'https://pmaisservicos.com.br/wp-admin/post.php?post=76001&action=edit',
      post_status: 'draft',
      audit_signature: 'f'.repeat(64),
    })

    const formatted = formatRequisitionHistoryObservation(observation)

    expect(formatted).toBe('Rascunho criado no WordPress após revisão da sugestão da Íris.')
    expect(formatted).not.toContain('{')
    expect(formatted).not.toContain('request-technical-id')
    expect(formatted).not.toContain('fingerprint')
    expect(formatted).not.toContain('sha256')
    expect(formatted).not.toContain('actor-technical-id')
    expect(formatted).not.toContain('76001')
  })

  it('translates the recognized manual contingency draft audit without exposing technical data', () => {
    const manualHashes = {
      titulo_sha256: 'a'.repeat(64),
      descricao_publica_sha256: 'b'.repeat(64),
      perfil_interno_sha256: 'c'.repeat(64),
    }
    const observation = JSON.stringify({
      schema_version: 'pmais_gv_wordpress_manual_contingency_audit_v1',
      operation_marker: 'd'.repeat(64),
      content_source: 'manual_contingency',
      actor_id: 'actor-technical-id',
      continuity_status: 'UNAVAILABLE',
      continuity_checked_at: '2026-10-27T15:00:00Z',
      continuity_reason_sha256: 'e'.repeat(64),
      continuity_state_age_seconds: 30,
      continuity_window_seconds: 2100,
      source_fingerprint: 'f'.repeat(64),
      reviewed_field_hashes: manualHashes,
      wordpress_job_id: '76001',
      wordpress_admin_url: 'https://example.com/wp-admin/post.php?post=76001&action=edit',
      post_status: 'draft',
      audit_signature: '1'.repeat(64),
    })

    const formatted = formatRequisitionHistoryObservation(observation)

    expect(formatted).toBe('Rascunho criado manualmente durante a contingência, após revisão do RH.')
    expect(formatted).not.toContain('actor-technical-id')
    expect(formatted).not.toContain('f'.repeat(64))
  })

  it('keeps ordinary human observations visible', () => {
    expect(formatRequisitionHistoryObservation('RH solicitou ajuste na jornada.')).toBe(
      'RH solicitou ajuste na jornada.',
    )
    expect(formatRequisitionHistoryObservation('[Urgente] ajustar jornada.')).toBe(
      '[Urgente] ajustar jornada.',
    )
  })

  it('never renders raw JSON for unknown, malformed, or almost-recognized audit objects', () => {
    expect(formatRequisitionHistoryObservation('{"schema_version":"unknown","secret":"value"}')).toBeNull()
    expect(formatRequisitionHistoryObservation('{malformed')).toBeNull()
    expect(
      formatRequisitionHistoryObservation(
        JSON.stringify({
          schema_version: 'pmais_gv_wordpress_draft_audit_v2',
          proof_request_id: 'request-technical-id',
        }),
      ),
    ).toBeNull()
  })
})
