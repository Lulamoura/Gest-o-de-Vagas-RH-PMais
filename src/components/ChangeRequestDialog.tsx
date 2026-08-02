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
import { createChangeRequest } from '@/services/requisition_change_requests'

export function ChangeRequestDialog({
  open,
  onOpenChange,
  requisitionId,
  solicitanteId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  requisitionId: string
  solicitanteId: string
}) {
  const [campos, setCampos] = useState('')
  const [valores, setValores] = useState('')
  const [justificativa, setJustificativa] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!campos.trim() || !valores.trim() || !justificativa.trim()) {
      toast.error('Preencha todos os campos')
      return
    }
    setSaving(true)
    try {
      await createChangeRequest({
        requisition: requisitionId,
        solicitante: solicitanteId,
        campos_alterados: campos.trim(),
        valores_propostos: valores.trim(),
        justificativa: justificativa.trim(),
        status: 'Pendente',
      })
      toast.success('Solicitação de alteração enviada!')
      setCampos('')
      setValores('')
      setJustificativa('')
      onOpenChange(false)
    } catch {
      toast.error('Erro ao criar solicitação')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar Alteração</DialogTitle>
          <DialogDescription>Solicite uma alteração na requisição aprovada</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Campos a alterar</Label>
            <Textarea
              rows={2}
              value={campos}
              onChange={(e) => setCampos(e.target.value)}
              placeholder="Ex: quantidade_vagas, prazo_desejado"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Valores propostos</Label>
            <Textarea
              rows={3}
              value={valores}
              onChange={(e) => setValores(e.target.value)}
              placeholder="Descreva os novos valores..."
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Justificativa</Label>
            <Textarea
              rows={2}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Motivo da alteração..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={saving} onClick={handleSubmit}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar Solicitação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
