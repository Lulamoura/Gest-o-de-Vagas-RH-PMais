import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { BaseIntegracaoRecord, CandidateRecord } from '@/types'
import { toast } from 'sonner'

interface IntegrationNoticeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidate: CandidateRecord | null
  baseIntegracoes: BaseIntegracaoRecord[]
  onSend: (baseIntegracaoId: string) => void
}

export function IntegrationNoticeModal({
  open,
  onOpenChange,
  candidate,
  baseIntegracoes,
  onSend,
}: IntegrationNoticeModalProps) {
  const [baseId, setBaseId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setBaseId('')
      setError('')
    }
  }, [open])

  const handleConfirm = () => {
    if (!baseId) {
      setError('Selecione uma base de integração')
      return
    }
    onSend(baseId)
  }

  const selectedBase = baseIntegracoes.find((b) => b.id === baseId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar Aviso de Integração Presencial</DialogTitle>
          <DialogDescription>
            Selecione a base de integração para incluir as informações no e-mail.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {candidate && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1 text-xs text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">Candidato:</span> {candidate.nome}
              </p>
              <p>
                <span className="font-semibold text-slate-900">E-mail de Destino:</span>{' '}
                {candidate.email || 'Não informado'}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Data:</span>{' '}
                {candidate.data_integracao || '—'}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Hora:</span>{' '}
                {candidate.hora_integracao || '—'}
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">
              Base de Integração <span className="text-rose-500">*</span>
            </Label>
            <Select value={baseId} onValueChange={setBaseId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma base" />
              </SelectTrigger>
              <SelectContent>
                {baseIntegracoes.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && <p className="text-xs text-rose-500">{error}</p>}
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
                {selectedBase.email && (
                  <p>
                    <strong>E-mail:</strong> {selectedBase.email}
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
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            className="bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
