import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { CurrencyInput } from '@/components/CurrencyInput'
import { ClinicaRecord, CandidateRecord } from '@/types'
import { sendExamReferral } from '@/services/candidates'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/pocketbase/errors'

interface ExamReferralModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidate: CandidateRecord | null
  clinicas: ClinicaRecord[]
  onSuccess: () => void
}

export function ExamReferralModal({
  open,
  onOpenChange,
  candidate,
  clinicas,
  onSuccess,
}: ExamReferralModalProps) {
  const [clinicaId, setClinicaId] = useState('')
  const [comentario, setComentario] = useState('')
  const [custoExames, setCustoExames] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (open) {
      setClinicaId('')
      setComentario('')
      setCustoExames(0)
      setErrors({})
    }
  }, [open])

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {}
    if (!clinicaId) newErrors.clinicaId = 'Selecione uma clínica'
    if (!comentario.trim()) newErrors.comentario = 'Comentário é obrigatório'
    if (custoExames <= 0) newErrors.custoExames = 'Informe um valor maior que zero'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    if (!candidate?.id) return

    setSending(true)
    try {
      await sendExamReferral(candidate.id, clinicaId, comentario, custoExames)
      toast.success('E-mail enviado e custo de exames atualizado com sucesso!')
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Erro ao enviar encaminhamento para exames.')
    } finally {
      setSending(false)
    }
  }

  const selectedClinic = clinicas.find((c) => c.id === clinicaId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar Informações para Exames</DialogTitle>
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
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">
              Clínica <span className="text-rose-500">*</span>
            </Label>
            <Select value={clinicaId} onValueChange={setClinicaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma clínica" />
              </SelectTrigger>
              <SelectContent>
                {clinicas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.clinicaId && <p className="text-xs text-rose-500">{errors.clinicaId}</p>}
            {selectedClinic && (
              <div className="text-xs text-slate-500 space-y-0.5 mt-1 p-2 bg-slate-50 rounded border border-slate-100">
                {selectedClinic.endereco && (
                  <p>
                    <strong>Endereço:</strong> {selectedClinic.endereco}
                  </p>
                )}
                {selectedClinic.telefone && (
                  <p>
                    <strong>Telefone:</strong> {selectedClinic.telefone}
                  </p>
                )}
                {selectedClinic.email && (
                  <p>
                    <strong>E-mail contato:</strong> {selectedClinic.email}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">
              Comentário <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Exames recomendados, horário de atendimento, instruções..."
              rows={4}
            />
            {errors.comentario && <p className="text-xs text-rose-500">{errors.comentario}</p>}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">
              Custo dos Exames (R$) <span className="text-rose-500">*</span>
            </Label>
            <CurrencyInput value={custoExames} onChange={setCustoExames} />
            {errors.custoExames && <p className="text-xs text-rose-500">{errors.custoExames}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={sending}
            className="bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            {sending ? 'Enviando...' : 'Enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
