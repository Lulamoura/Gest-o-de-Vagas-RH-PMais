import { useState, useEffect } from 'react'
import { getChangeRequests } from '@/services/requisition_change_requests'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateBR } from '@/lib/status-utils'
import { Loader2, MessageSquare } from 'lucide-react'
import { ChangeRequestDecisionDialog } from '@/components/ChangeRequestDecisionDialog'
import type { RequisitionChangeRequestRecord } from '@/types'

const STATUS_BADGE: Record<string, string> = {
  Pendente: 'bg-amber-100 text-amber-800 border-amber-200',
  Aprovada: 'bg-green-100 text-green-800 border-green-200',
  Reprovada: 'bg-rose-100 text-rose-800 border-rose-200',
}

export function RequisitionChangeRequests({ requisitionId }: { requisitionId: string }) {
  const { user } = useAuth()
  const [requests, setRequests] = useState<RequisitionChangeRequestRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [decisionTarget, setDecisionTarget] = useState<string | null>(null)

  const isAdmin = user?.profile === 'admin' || user?.profile === 'superadmin'

  const loadData = async () => {
    try {
      setRequests(await getChangeRequests(requisitionId))
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [requisitionId])
  useRealtime('requisition_change_requests', () => loadData())

  if (loading)
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )

  if (requests.length === 0)
    return (
      <p className="text-center text-muted-foreground py-8 text-sm">
        Nenhuma solicitação de alteração.
      </p>
    )

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        {requests.map((r) => (
          <div key={r.id} className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className={STATUS_BADGE[r.status]}>{r.status}</Badge>
                <span className="text-xs text-muted-foreground">
                  {r.expand?.solicitante?.name || '—'} — {r.created ? formatDateBR(r.created) : ''}
                </span>
              </div>
              {isAdmin && r.status === 'Pendente' && r.solicitante !== user?.id && (
                <Button size="sm" variant="outline" onClick={() => setDecisionTarget(r.id)}>
                  <MessageSquare className="h-3.5 w-3.5 mr-1" /> Decidir
                </Button>
              )}
            </div>
            <div className="text-sm space-y-1">
              <p>
                <span className="font-medium">Campos:</span> {r.campos_alterados}
              </p>
              <p>
                <span className="font-medium">Valores:</span> {r.valores_propostos}
              </p>
              <p>
                <span className="font-medium">Justificativa:</span> {r.justificativa}
              </p>
            </div>
            {r.decisao_comentario && (
              <p className="text-sm text-muted-foreground italic">
                Decisão por {r.expand?.decidido_por?.name || '—'}: &quot;{r.decisao_comentario}
                &quot;
              </p>
            )}
          </div>
        ))}
        <ChangeRequestDecisionDialog
          open={!!decisionTarget}
          onOpenChange={(v) => !v && setDecisionTarget(null)}
          changeRequestId={decisionTarget}
        />
      </CardContent>
    </Card>
  )
}
