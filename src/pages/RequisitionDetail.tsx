import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getRequisition } from '@/services/requisitions'
import { RequisitionRecord } from '@/types'
import { formatDateBR } from '@/lib/status-utils'
import { DEPARTAMENTO_LABELS, REQUISITION_STATUS_BADGE } from '@/lib/requisition-utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft } from 'lucide-react'

export default function RequisitionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [req, setReq] = useState<RequisitionRecord | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    getRequisition(id)
      .then(setReq)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    )
  if (!req)
    return <div className="text-center py-12 text-slate-500">Requisição não encontrada.</div>

  const fields: [string, string | undefined][] = [
    ['Solicitante', req.expand?.solicitante?.name],
    ['Departamento', req.departamento ? DEPARTAMENTO_LABELS[req.departamento] : undefined],
    ['Cliente', req.expand?.cliente?.nome],
    ['Cargo', req.expand?.cargo?.nome],
    ['Cidade', req.expand?.cidade?.nome],
    ['Tipo de Vaga', req.expand?.tipo_vaga?.nome],
    ['Tipo de Contrato', req.expand?.tipo_contrato?.nome],
    ['Quantidade de Vagas', String(req.quantidade_vagas || 0)],
    ['Prioridade', req.prioridade],
    ['Faixa Salarial', req.faixa_salarial],
    ['Prazo Desejado', formatDateBR(req.prazo_desejado)],
    ['Criado em', formatDateBR(req.created)],
    ['Atualizado em', formatDateBR(req.updated)],
  ]

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Button variant="ghost" onClick={() => navigate('/requisicoes')} className="text-slate-600">
        <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
      </Button>
      <Card className="border-slate-200 shadow-md">
        <CardHeader className="bg-slate-50/80 border-b border-slate-200 flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-bold text-slate-900">Detalhes da Requisição</CardTitle>
          <Badge variant="outline" className={REQUISITION_STATUS_BADGE[req.status]}>
            {req.status}
          </Badge>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {fields.map(([label, value]) => (
              <div key={label} className="border-b border-slate-100 pb-2">
                <span className="text-xs text-slate-500 block">{label}</span>
                <span className="text-sm font-medium text-slate-800">{value || '—'}</span>
              </div>
            ))}
          </div>
          {req.justificativa && (
            <div className="pt-2">
              <span className="text-xs text-slate-500 block mb-1">Justificativa</span>
              <p className="text-sm text-slate-800 bg-slate-50 p-3 rounded-lg">
                {req.justificativa}
              </p>
            </div>
          )}
          {req.especificacoes && (
            <div className="pt-2">
              <span className="text-xs text-slate-500 block mb-1">Especificações</span>
              <p className="text-sm text-slate-800 bg-slate-50 p-3 rounded-lg">
                {req.especificacoes}
              </p>
            </div>
          )}
          {req.observacoes_internas && (
            <div className="pt-2">
              <span className="text-xs text-slate-500 block mb-1">Observações Internas</span>
              <p className="text-sm text-slate-800 bg-slate-50 p-3 rounded-lg">
                {req.observacoes_internas}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
