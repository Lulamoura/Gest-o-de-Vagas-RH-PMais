import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BaseIntegracaoRecord } from '@/types'
import { sendIntegrationNotice } from '@/services/candidates'
import { toast } from 'sonner'
import { Mail } from 'lucide-react'

interface IntegrationNoticeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidateId: string
  tipoIntegracao: string
  baseIntegracaoList: BaseIntegracaoRecord[]
  onSuccess: () => void
}

export function IntegrationNoticeModal({
  open,
  onOpenChange,
  candidateId,
  tipoIntegracao,
  baseIntegracaoList,
  onSuccess,
}: IntegrationNoticeModalProps) {
  const [baseId, setBaseId] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (open) {
      setBaseId('')
    }
  }, [open])

  const handleSend = async () => {
    if (tipoIntegracao === 'Presencial' && !baseId) {
      toast.error('Selecione uma Base de Integração')
      return
    }
    setSending(true)
    try {
      await sendIntegrationNotice(
        candidateId,
        tipoIntegracao,
        tipoIntegracao === 'Presencial' ? baseId : null,
      )
      toast.success('Aviso de integração enviado com sucesso!')
      onOpenChange(false)
      onSuccess()
    } catch {
      toast.error('Erro ao enviar aviso de integração')
    } finally {
      setSending(false)
    }
  }

  const selectedBase = baseIntegracaoList.find((b) => b.id === baseId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar Aviso de Integração</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {tipoIntegracao === 'Presencial' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                Base de Integração <span className="text-rose-500">*</span>
              </Label>
              <Select value={baseId} onValueChange={setBaseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma base" />
                </SelectTrigger>
                <SelectContent>
                  {baseIntegracaoList.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedBase && (
                <div className="text-xs text-slate-500 space-y-0.5 mt-1 p-2 bg-slate-50 rounded border border-slate-100">
                  {selectedBase.endereco && (
                    <p>
                      <strong>Endereço:</strong> {selectedBase.endereco}
                    </p>
                  )}
                  {selectedBase.telefone && (
                    <p>
                      <strong>Telefone:</strong> {selectedBase.telefone}
                    </p>
                  )}
                  {selectedBase.pessoa_contato && (
                    <p>
                      <strong>Contato:</strong> {selectedBase.pessoa_contato}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          {tipoIntegracao === 'On-line' && (
            <p className="text-sm text-slate-600">
              Será enviado um e-mail ao candidato informando a data e hora da integração,
              mencionando que o link da reunião online será enviado alguns minutos antes do horário
              agendado.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSend}
            disabled={sending}
            className="bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            <Mail className="h-4 w-4 mr-2" />
            {sending ? 'Enviando...' : 'Enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
