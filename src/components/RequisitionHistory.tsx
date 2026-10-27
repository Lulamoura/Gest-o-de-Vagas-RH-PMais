import { useState, useEffect } from 'react'
import { getRequisitionHistory } from '@/services/requisition_history'
import { useRealtime } from '@/hooks/use-realtime'
import { Card, CardContent } from '@/components/ui/card'
import { formatDateBR } from '@/lib/status-utils'
import { Loader2 } from 'lucide-react'
import type { RequisitionHistoryRecord } from '@/types'

const HASH_PATTERN = /^[a-f0-9]{64}$/

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasExactKeys = (value: Record<string, unknown>, expected: string[]) => {
  const actual = Object.keys(value).sort()
  const sortedExpected = [...expected].sort()
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  )
}

const hasManualReviewedHashes = (value: unknown) =>
  isRecord(value) &&
  hasExactKeys(value, ['titulo_sha256', 'descricao_publica_sha256', 'perfil_interno_sha256']) &&
  Object.values(value).every((hash) => typeof hash === 'string' && HASH_PATTERN.test(hash))

export const formatRequisitionHistoryObservation = (observation?: string): string | null => {
  if (!observation) return null
  const trimmed = observation.trimStart()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return observation

  let audit: unknown
  try {
    audit = JSON.parse(observation)
  } catch {
    return trimmed.startsWith('[') ? observation : null
  }
  if (!isRecord(audit)) return null

  if (
    audit.schema_version === 'pmais_gv_wordpress_draft_audit_v2' &&
    hasExactKeys(audit, [
      'schema_version',
      'operation_marker',
      'actor_id',
      'proof_request_id',
      'second_brain_version',
      'second_brain_sha256',
      'source_fingerprint',
      'reviewed_field_hashes',
      'wordpress_job_id',
      'wordpress_admin_url',
      'post_status',
      'audit_signature',
    ]) &&
    typeof audit.operation_marker === 'string' &&
    HASH_PATTERN.test(audit.operation_marker) &&
    typeof audit.actor_id === 'string' &&
    audit.actor_id.length > 0 &&
    typeof audit.proof_request_id === 'string' &&
    audit.proof_request_id.length > 0 &&
    typeof audit.second_brain_version === 'string' &&
    audit.second_brain_version.length > 0 &&
    typeof audit.second_brain_sha256 === 'string' &&
    HASH_PATTERN.test(audit.second_brain_sha256) &&
    typeof audit.source_fingerprint === 'string' &&
    HASH_PATTERN.test(audit.source_fingerprint) &&
    hasManualReviewedHashes(audit.reviewed_field_hashes) &&
    typeof audit.wordpress_job_id === 'string' &&
    /^\d+$/.test(audit.wordpress_job_id) &&
    typeof audit.wordpress_admin_url === 'string' &&
    audit.wordpress_admin_url.length > 0 &&
    audit.post_status === 'draft' &&
    typeof audit.audit_signature === 'string' &&
    HASH_PATTERN.test(audit.audit_signature)
  ) {
    return 'Rascunho criado no WordPress após revisão da sugestão da Íris.'
  }

  if (
    audit.schema_version === 'pmais_gv_wordpress_manual_contingency_audit_v1' &&
    hasExactKeys(audit, [
      'schema_version',
      'operation_marker',
      'content_source',
      'actor_id',
      'continuity_status',
      'continuity_checked_at',
      'continuity_reason_sha256',
      'continuity_state_age_seconds',
      'continuity_window_seconds',
      'source_fingerprint',
      'reviewed_field_hashes',
      'wordpress_job_id',
      'wordpress_admin_url',
      'post_status',
      'audit_signature',
    ]) &&
    audit.content_source === 'manual_contingency' &&
    audit.continuity_status === 'UNAVAILABLE' &&
    audit.post_status === 'draft' &&
    typeof audit.actor_id === 'string' &&
    typeof audit.continuity_checked_at === 'string' &&
    typeof audit.continuity_state_age_seconds === 'number' &&
    typeof audit.continuity_window_seconds === 'number' &&
    typeof audit.wordpress_job_id === 'string' &&
    typeof audit.wordpress_admin_url === 'string' &&
    typeof audit.operation_marker === 'string' &&
    HASH_PATTERN.test(audit.operation_marker) &&
    typeof audit.continuity_reason_sha256 === 'string' &&
    HASH_PATTERN.test(audit.continuity_reason_sha256) &&
    typeof audit.source_fingerprint === 'string' &&
    HASH_PATTERN.test(audit.source_fingerprint) &&
    typeof audit.audit_signature === 'string' &&
    HASH_PATTERN.test(audit.audit_signature) &&
    hasManualReviewedHashes(audit.reviewed_field_hashes)
  ) {
    return 'Rascunho criado manualmente durante a contingência, após revisão do RH.'
  }

  return null
}

export function RequisitionHistory({ requisitionId }: { requisitionId: string }) {
  const [history, setHistory] = useState<RequisitionHistoryRecord[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      setHistory(await getRequisitionHistory(requisitionId))
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [requisitionId])
  useRealtime('requisition_history', () => loadData())

  if (loading)
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  if (history.length === 0)
    return (
      <p className="text-center text-muted-foreground py-8 text-sm">Nenhum histórico registrado.</p>
    )

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {history.map((h, idx) => {
            const observation = formatRequisitionHistoryObservation(h.observacao)
            return (
              <div key={h.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="h-3 w-3 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                  {idx < history.length - 1 && <div className="w-px flex-1 bg-border" />}
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{h.acao || h.status_novo}</span>
                    <span className="text-xs text-muted-foreground">
                      {h.data_mudanca ? formatDateBR(h.data_mudanca) : ''}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Por: {h.expand?.usuario_id?.name || 'Sistema'} — {h.status_anterior || 'Início'}{' '}
                    → {h.status_novo}
                  </p>
                  {observation && (
                    <p className="text-sm text-muted-foreground mt-1 italic">"{observation}"</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
