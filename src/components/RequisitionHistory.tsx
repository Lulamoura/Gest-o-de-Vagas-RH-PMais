import { useState, useEffect } from 'react'
import { getRequisitionHistory } from '@/services/requisition_history'
import { useRealtime } from '@/hooks/use-realtime'
import { Card, CardContent } from '@/components/ui/card'
import { formatDateBR } from '@/lib/status-utils'
import { Loader2 } from 'lucide-react'
import type { RequisitionHistoryRecord } from '@/types'

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
          {history.map((h, idx) => (
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
                  Por: {h.expand?.usuario_id?.name || 'Sistema'} — {h.status_anterior || 'Início'} →{' '}
                  {h.status_novo}
                </p>
                {h.observacao && (
                  <p className="text-sm text-muted-foreground mt-1 italic">"{h.observacao}"</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
