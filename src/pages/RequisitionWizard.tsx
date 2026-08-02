import { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Loader2, Check, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { extractFieldErrors, getErrorMessage } from '@/lib/pocketbase/errors'
import { getRequisition, createRequisition, updateRequisition } from '@/services/requisitions'
import { getClientes } from '@/services/clientes'
import { getCargos } from '@/services/cargos'
import { getCidades } from '@/services/cidades'
import { getTiposVaga } from '@/services/tipos_vaga'
import { getTiposContrato } from '@/services/tipos_contrato'
import { toDateInputValue } from '@/lib/status-utils'
import type {
  ClienteRecord,
  CargoRecord,
  CidadeRecord,
  TipoVagaRecord,
  TipoContratoRecord,
} from '@/types'

const STEPS = ['Identificação', 'Detalhes da Vaga', 'Especificações', 'Revisão']

interface FormData {
  numero_oe: string
  departamento: string
  cliente: string
  cargo: string
  cidade: string
  tipo_vaga: string
  tipo_contrato: string
  quantidade_vagas: number
  prazo_desejado: string
  prioridade: string
  faixa_salarial: string
  justificativa: string
  especificacoes: string
  observacoes_internas: string
}

const emptyForm: FormData = {
  numero_oe: '',
  departamento: '',
  cliente: '',
  cargo: '',
  cidade: '',
  tipo_vaga: '',
  tipo_contrato: '',
  quantidade_vagas: 1,
  prazo_desejado: '',
  prioridade: 'Média',
  faixa_salarial: '',
  justificativa: '',
  especificacoes: '',
  observacoes_internas: '',
}

export default function RequisitionWizard() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const duplicateId = searchParams.get('duplicate')
  const navigate = useNavigate()
  const { user } = useAuth()

  const isEdit = !!id && !duplicateId
  const isDuplicate = !!duplicateId

  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [clientes, setClientes] = useState<ClienteRecord[]>([])
  const [cargos, setCargos] = useState<CargoRecord[]>([])
  const [cidades, setCidades] = useState<CidadeRecord[]>([])
  const [tiposVaga, setTiposVaga] = useState<TipoVagaRecord[]>([])
  const [tiposContrato, setTiposContrato] = useState<TipoContratoRecord[]>([])
  const [formData, setFormData] = useState<FormData>(emptyForm)

  useEffect(() => {
    const load = async () => {
      try {
        const [cli, car, cid, tv, tc] = await Promise.all([
          getClientes(),
          getCargos(),
          getCidades(),
          getTiposVaga(),
          getTiposContrato(),
        ])
        setClientes(cli)
        setCargos(car)
        setCidades(cid)
        setTiposVaga(tv)
        setTiposContrato(tc)

        const sourceId = isEdit ? id : duplicateId
        if (sourceId) {
          const req = await getRequisition(sourceId)
          if (isEdit && req.status !== 'Rascunho') {
            toast.error('Apenas requisições em rascunho podem ser editadas')
            navigate('/requisicoes')
            return
          }
          setFormData({
            numero_oe: req.numero_oe || '',
            departamento: req.departamento || '',
            cliente: req.cliente || '',
            cargo: isDuplicate ? '' : req.cargo || '',
            cidade: req.cidade || '',
            tipo_vaga: req.tipo_vaga || '',
            tipo_contrato: req.tipo_contrato || '',
            quantidade_vagas: req.quantidade_vagas || 1,
            prazo_desejado: toDateInputValue(req.prazo_desejado) || '',
            prioridade: req.prioridade || 'Média',
            faixa_salarial: req.faixa_salarial || '',
            justificativa: req.justificativa || '',
            especificacoes: req.especificacoes || '',
            observacoes_internas: req.observacoes_internas || '',
          })
        } else if (user?.departamento) {
          setFormData((prev) => ({ ...prev, departamento: user.departamento }))
        }
      } catch {
        toast.error('Erro ao carregar dados')
        navigate('/requisicoes')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, duplicateId])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const updateField = (field: keyof FormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field])
      setErrors((prev) => {
        const n = { ...prev }
        delete n[field]
        return n
      })
  }

  const validate = (forApproval: boolean): boolean => {
    const errs: Record<string, string> = {}
    if (!formData.justificativa.trim()) errs.justificativa = 'Justificativa é obrigatória'
    if (forApproval && !formData.numero_oe.trim())
      errs.numero_oe = 'Número da OE é obrigatório para envio ao RH'
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      if (errs.numero_oe) setCurrentStep(0)
      else if (errs.justificativa) setCurrentStep(2)
      return false
    }
    return true
  }

  const handleSave = async (forApproval: boolean) => {
    if (!user || !validate(forApproval)) return
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        ...formData,
        solicitante: user.id,
        status: forApproval ? 'Aguardando aprovação' : 'Rascunho',
      }
      if (isEdit && id) {
        await updateRequisition(id, payload)
        toast.success('Requisição atualizada')
      } else {
        await createRequisition(payload)
        toast.success(forApproval ? 'Requisição enviada para aprovação' : 'Rascunho salvo')
      }
      navigate('/requisicoes')
    } catch (err) {
      setErrors(extractFieldErrors(err))
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const fieldErr = (f: string) =>
    errors[f] ? <p className="text-sm text-red-500 mt-1">{errors[f]}</p> : null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/requisicoes')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">
          {isEdit ? 'Editar Requisição' : isDuplicate ? 'Duplicar Requisição' : 'Nova Requisição'}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {STEPS.map((step, idx) => (
          <div key={step} className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
                idx === currentStep
                  ? 'bg-primary text-primary-foreground'
                  : idx < currentStep
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              {idx < currentStep ? <Check className="h-4 w-4" /> : idx + 1}
            </div>
            <span
              className={cn(
                'text-sm hidden sm:inline',
                idx === currentStep ? 'font-medium' : 'text-muted-foreground',
              )}
            >
              {step}
            </span>
            {idx < STEPS.length - 1 && <div className="h-px w-6 sm:w-12 bg-border" />}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[currentStep]}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentStep === 0 && (
            <>
              <div>
                <Label htmlFor="numero_oe">Número da OE *</Label>
                <Input
                  id="numero_oe"
                  value={formData.numero_oe}
                  onChange={(e) => updateField('numero_oe', e.target.value)}
                  placeholder="Informe o número da OE"
                />
                {fieldErr('numero_oe')}
              </div>
              <div>
                <Label>Departamento</Label>
                <Select
                  value={formData.departamento}
                  onValueChange={(v) => updateField('departamento', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comercial">Comercial</SelectItem>
                    <SelectItem value="operacional">Operacional</SelectItem>
                    <SelectItem value="rh">RH</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cliente</Label>
                <Select value={formData.cliente} onValueChange={(v) => updateField('cliente', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cargo</Label>
                <Select value={formData.cargo} onValueChange={(v) => updateField('cargo', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {cargos.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cidade</Label>
                <Select value={formData.cidade} onValueChange={(v) => updateField('cidade', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {cidades.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {currentStep === 1 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo de Vaga</Label>
                  <Select
                    value={formData.tipo_vaga}
                    onValueChange={(v) => updateField('tipo_vaga', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposVaga.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo de Contrato</Label>
                  <Select
                    value={formData.tipo_contrato}
                    onValueChange={(v) => updateField('tipo_contrato', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposContrato.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Quantidade de Vagas</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.quantidade_vagas}
                    onChange={(e) => updateField('quantidade_vagas', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label>Prazo Desejado</Label>
                  <Input
                    type="date"
                    value={formData.prazo_desejado}
                    onChange={(e) => updateField('prazo_desejado', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Prioridade</Label>
                  <Select
                    value={formData.prioridade}
                    onValueChange={(v) => updateField('prioridade', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Alta">Alta</SelectItem>
                      <SelectItem value="Média">Média</SelectItem>
                      <SelectItem value="Baixa">Baixa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Faixa Salarial</Label>
                  <Input
                    value={formData.faixa_salarial}
                    onChange={(e) => updateField('faixa_salarial', e.target.value)}
                    placeholder="Ex: R$ 2.000 - R$ 3.000"
                  />
                </div>
              </div>
            </>
          )}

          {currentStep === 2 && (
            <>
              <div>
                <Label>Justificativa *</Label>
                <Textarea
                  rows={3}
                  value={formData.justificativa}
                  onChange={(e) => updateField('justificativa', e.target.value)}
                />
                {fieldErr('justificativa')}
              </div>
              <div>
                <Label>Especificações</Label>
                <Textarea
                  rows={4}
                  value={formData.especificacoes}
                  onChange={(e) => updateField('especificacoes', e.target.value)}
                />
              </div>
              <div>
                <Label>Observações Internas</Label>
                <Textarea
                  rows={3}
                  value={formData.observacoes_internas}
                  onChange={(e) => updateField('observacoes_internas', e.target.value)}
                />
              </div>
            </>
          )}

          {currentStep === 3 && (
            <div className="space-y-3">
              {[
                ['Número da OE', formData.numero_oe],
                ['Departamento', formData.departamento],
                ['Cliente', clientes.find((c) => c.id === formData.cliente)?.nome],
                ['Cargo', cargos.find((c) => c.id === formData.cargo)?.nome],
                ['Cidade', cidades.find((c) => c.id === formData.cidade)?.nome],
                ['Tipo de Vaga', tiposVaga.find((t) => t.id === formData.tipo_vaga)?.nome],
                [
                  'Tipo de Contrato',
                  tiposContrato.find((t) => t.id === formData.tipo_contrato)?.nome,
                ],
                ['Quantidade', String(formData.quantidade_vagas)],
                ['Prazo', formData.prazo_desejado],
                ['Prioridade', formData.prioridade],
                ['Faixa Salarial', formData.faixa_salarial],
                ['Justificativa', formData.justificativa],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-right">{value || '-'}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
          disabled={currentStep === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={saving} onClick={() => handleSave(false)}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar Rascunho'}
          </Button>
          <Button disabled={saving} onClick={() => handleSave(true)}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar para Aprovação'}
          </Button>
        </div>
        <Button
          variant="outline"
          onClick={() => setCurrentStep((s) => Math.min(3, s + 1))}
          disabled={currentStep === 3}
        >
          Próximo <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}
