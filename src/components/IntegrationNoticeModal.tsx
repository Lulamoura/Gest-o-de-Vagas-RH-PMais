import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { BaseIntegracaoRecord } from '@/types'
import { MapPin } from 'lucide-react'

interface IntegrationNoticeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  baseIntegracao: BaseIntegracaoRecord[]
  onSend: (baseId: string) => void
  sending: boolean
}

export function IntegrationNoticeModal({
  open,
  onOpenChange,
  baseIntegracao,
  onSend,
  sending,
}: IntegrationNoticeModalProps) {
  const [selectedId, setSelectedId] = useState('')

  useEffect(() => {
    if (open) setSelectedId('')
  }, [open])

  const selected = baseIntegracao.find((b) => b.id === selectedId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Selecionar Base de Integração</DialogTitle>
          <DialogDescription>
            Escolha o local de integração para incluir no aviso.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a base" />
            </SelectTrigger>
            <SelectContent>
              {baseIntegracao.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selected && (
            <div className="text-xs space-y-1 p-3 bg-slate-50 rounded border border-slate-100">
              {selected.endereco && (
                <p>
                  <strong>Endereço:</strong> {selected.endereco}
                </p>
              )}
              {selected.telefone && (
                <p>
                  <strong>Telefone:</strong> {selected.telefone}
                </p>
              )}
              {selected.pessoa_contato && (
                <p>
                  <strong>Contato:</strong> {selected.pessoa_contato}
                </p>
              )}
              {selected.endereco && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.endereco)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline flex items-center gap-1 mt-1"
                >
                  <MapPin className="h-3 w-3" /> Ver no Google Maps
                </a>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!selectedId || sending}
            onClick={() => onSend(selectedId)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            {sending ? 'Enviando...' : 'Enviar Aviso'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
