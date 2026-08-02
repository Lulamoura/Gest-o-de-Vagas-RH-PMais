import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { decideChangeRequest } from '@/services/requisition_change_requests'

export function ChangeRequestDecisionDialog({
  open,
  onOpenChange,
  changeRequestId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  changeRequestId: string | null
}) {
  const [comentario, setComentario] = useState('')
  const [saving, setSaving] = useState(false)

  const handleDecide = async (status: 'Aprovada' | 'Reprovada') => {
    if (!changeRequestId) return
    setSaving(true)
    try {
      await decideChangeRequest(changeRequestId, status, comentario.trim())
      toast.success(status === 'Aprovada' ? 'Alteração aprovada!' : 'Alteração reprovada!')
      setComentario('')
      onOpenChange(false)
    } catch {
      toast.error('Erro ao processar decisão')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Decidir Solicitação de Alteração</DialogTitle>
          <DialogDescription>
            Aprove ou reprove a solicitação (opcional comentário)
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="text-xs">Comentário de decisão (opcional)</Label>
          <Textarea
            rows={3}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Comentário sobre a decisão..."
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => handleDecide('Reprovada')}
            className="text-rose-600 border-rose-300 hover:bg-rose-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reprovar'}
          </Button>
          <Button
            disabled={saving}
            onClick={() => handleDecide('Aprovada')}
            className="bg-green-600 hover:bg-green-500 text-white"
          >
            Aprovar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
