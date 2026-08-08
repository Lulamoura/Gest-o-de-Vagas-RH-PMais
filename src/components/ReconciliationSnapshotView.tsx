import { type ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ReconciliationSnapshot } from '@/services/reconciliation'

interface Props {
  title: string
  snapshot: ReconciliationSnapshot | null
  requisitionId: string
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/40 py-1.5">
      <span className="shrink-0 font-medium text-muted-foreground">{label}</span>
      <span className="break-words text-right whitespace-pre-wrap">{value || '—'}</span>
    </div>
  )
}

export function ReconciliationSnapshotView({ title, snapshot, requisitionId }: Props) {
  if (!snapshot) return null
  const { vacancy, vacancy_count, requisition } = snapshot

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-0 text-sm">
        {vacancy && (
          <>
            <Row label="Vacancy ID" value={vacancy.id} />
            <Row label="Cliente" value={vacancy.cliente} />
            <Row label="Salário Faixa" value={vacancy.salario_faixa} />
            <Row label="Prioridade" value={vacancy.prioridade} />
            <Row label="Especificações" value={vacancy.especificacoes} />
            <Row label="Observações Internas" value={vacancy.observacoes_internas} />
            <Row label="Perfil Interno" value={vacancy.perfil_interno} />
            <Row label="Requisition ID" value={requisitionId} />
            <Row label="WordPress Job ID" value={vacancy.wordpress_job_id} />
            <Row label="Updated" value={vacancy.updated} />
            <Row
              label="Status Vaga"
              value={<Badge variant="outline">{vacancy.status_vaga}</Badge>}
            />
            <Row label="Cargo" value={vacancy.cargo} />
            <Row label="Cidade" value={vacancy.cidade} />
            <Row label="Tipo Vaga" value={vacancy.tipo_vaga} />
            <Row label="Tipo Contrato" value={vacancy.tipo_contrato} />
            <Row label="Qtd Vagas" value={String(vacancy.quantidade_vagas)} />
            <Row label="Prazo Desejado" value={vacancy.prazo_desejado} />
            <Row label="Resp. Operacional" value={vacancy.responsavel_operacional} />
            <Row label="Ordem Execução" value={vacancy.ordem_execucao} />
            <Row label="Link Público" value={vacancy.link_publico} />
            <Row label="Data Abertura" value={vacancy.data_abertura} />
            <Row label="Origem" value={vacancy.origem} />
          </>
        )}
        <Row label="Vacancy Count (wp_job_id)" value={<Badge>{vacancy_count}</Badge>} />
        {requisition && (
          <>
            <Row
              label="Requisition Status"
              value={
                <Badge
                  className={cn(
                    requisition.status === 'Publicada' ? 'bg-green-600' : 'bg-destructive',
                  )}
                >
                  {requisition.status}
                </Badge>
              }
            />
            <Row label="Req. WP Job ID" value={requisition.wordpress_job_id} />
            <Row label="Req. Sync Status" value={requisition.wordpress_sync_status} />
          </>
        )}
      </CardContent>
    </Card>
  )
}
