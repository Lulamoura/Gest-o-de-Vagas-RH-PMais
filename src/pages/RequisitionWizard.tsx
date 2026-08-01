import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createRequisition, getRequisition, updateRequisition } from '@/services/requisitions'
import { getClientes } from '@/services/clientes'
import { getCargos } from '@/services/cargos'
import { getCidades } from '@/services/cidades'
import { getTiposVaga } from '@/services/tipos_vaga'
import { getTiposContrato } from '@/services/tipos_contrato'
import {
  ClienteRecord,
  CargoRecord,
  CidadeRecord,
  TipoVagaRecord,
  TipoContratoRecord,
  RequisitionDepartamento,
  VacancyPriority,
} from '@/types'
import { useAuth } from '@/hooks/use-auth'
import { toDateInputValue } from '@/lib/status-utils'
import { DEPARTAMENTO_OPTIONS, WIZARD_STEPS, DEPARTAMENTO_LABELS } from '@/lib/requisition-utils'
import { Combobox } from '@/components/Combobox'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, Save, Send, Check } from 'lucide-react'

interface FormData {
  departamento: string
  cliente: string
  cargo: string
  cidade: string
  tipo_vaga: string
  tipo_contrato: string
  quantidade_vagas: number
  prioridade: string
  faixa_salarial: string
  prazo_desejado: string
  especificacoes: string
  justificativa: string
  observacoes_internas: string
}

const EMPTY_FORM: FormData = {
  departamento: '',
  cliente: '',
  cargo: '',
  cidade: '',
  tipo_vaga: '',
  tipo_contrato: '',
  quantidade_vagas: 1,
  prioridade: '',
  faixa_salarial: '',
  prazo_desejado: '',
  especificacoes: '',
  justificativa: '',
  observacoes_internas: '',
}

export default function RequisitionWizard() {
  const { id } = useParams<{ id: string }>()
  const isEditing = !!id
  const navigate = useNavigate()
  const { user } = useAuth()

  const [clientes, setClientes] = useState<ClienteRecord[]>([])
  const [cargos, setCargos] = useState<CargoRecord[]>([])
  const [cidades, setCidades] = useState<CidadeRecord[]>([])
  const [tiposVaga, setTiposVaga] = useState<TipoVagaRecord[]>([])
  const [tiposContrato, setTiposContrato] = useState<TipoContratoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const savingRef = useRef(false)
  const submittingRef = useRef(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [cl, cg, cd, tv, tc] = await Promise.all([
          getClientes(),
          getCargos(),
          getCidades(),
          getTiposVaga(),
          getTiposContrato(),
        ])
        setClientes(cl)
        setCargos(cg)
        setCidades(cd)
        setTiposVaga(tv)
        setTiposContrato(tc)
        if (isEditing && id) {
          const req = await getRequisition(id)
          if (req.status !== 'Rascunho') {
            navigate(`/requisicoes/${id}`)
            return
          }
          setForm({
            departamento: req.departamento || '',
            cliente: req.cliente || '',
            cargo: req.cargo || '',
            cidade: req.cidade || '',
            tipo_vaga: req.tipo_vaga || '',
            tipo_contrato: req.tipo_contrato || '',
            quantidade_vagas: req.quantidade_vagas || 1,
            prioridade: req.prioridade || '',
            faixa_salarial: req.faixa_salarial || '',
            prazo_desejado: toDateInputValue(req.prazo_desejado),
            especificacoes: req.especificacoes || '',
            justificativa: req.justificativa || '',
            observacoes_internas: req.observacoes_internas || '',
          })
        } else if (user?.departamento) {
          setForm((prev) => ({ ...prev, departamento: user.departamento! }))
        }
      } catch {
        toast.error('Erro ao carregar dados')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, isEditing, user])

  const set = (key: keyof FormData, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      const n = { ...prev }
      delete n[key]
      return n
    })
  }

  const validateStep = (s: number): boolean => {
    const errs: Record<string, string> = {}
    if (s === 1) {
      if (!form.departamento) errs.departamento = 'Departamento é obrigatório'
      if (!form.cliente) errs.cliente = 'Cliente é obrigatório'
      if (!form.cargo) errs.cargo = 'Cargo é obrigatório'
      if (!form.cidade) errs.cidade = 'Cidade é obrigatória'
      if (!form.tipo_vaga) errs.tipo_vaga = 'Tipo de vaga é obrigatório'
      if (!form.tipo_contrato) errs.tipo_contrato = 'Tipo de contrato é obrigatório'
      if (!form.quantidade_vagas || form.quantidade_vagas < 1)
        errs.quantidade_vagas = 'Mínimo de 1 vaga'
    }
    if (s === 2 && !form.prioridade) errs.prioridade = 'Prioridade é obrigatória'
    if (s === 3 && !form.justificativa.trim()) errs.justificativa = 'Justificativa é obrigatória'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const allRequiredValid = useMemo(() => {
    return !!(
      form.departamento &&
      form.cliente &&
      form.cargo &&
      form.cidade &&
      form.tipo_vaga &&
      form.tipo_contrato &&
      form.quantidade_vagas >= 1 &&
      form.prioridade &&
      form.justificativa.trim()
    )
  }, [form])

  const handleNext = () => {
    if (validateStep(step)) setStep((s) => Math.min(s + 1, 4))
  }
  const handleBack = () => {
    setStep((s) => Math.max(s - 1, 1))
    setErrors({})
  }

  const buildPayload = (status: 'Rascunho' | 'Aguardando aprovação') => ({
    departamento: form.departamento || undefined,
    cliente: form.cliente || undefined,
    cargo: form.cargo || undefined,
    cidade: form.cidade || undefined,
    tipo_vaga: form.tipo_vaga || undefined,
    tipo_contrato: form.tipo_contrato || undefined,
    quantidade_vagas: Number(form.quantidade_vagas),
    prioridade: (form.prioridade as VacancyPriority) || undefined,
    faixa_salarial: form.faixa_salarial || undefined,
    prazo_desejado: form.prazo_desejado ? new Date(form.prazo_desejado).toISOString() : undefined,
    especificacoes: form.especificacoes || undefined,
    justificativa: form.justificativa,
    observacoes_internas: form.observacoes_internas || undefined,
    status,
  })

  const handleSaveDraft = async () => {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    try {
      if (isEditing && id) {
        await updateRequisition(id, buildPayload('Rascunho'))
        toast.success('Rascunho atualizado com sucesso!')
      } else {
        await createRequisition({ ...buildPayload('Rascunho'), solicitante: user?.id })
        toast.success('Rascunho salvo com sucesso!')
        navigate('/requisicoes')
      }
    } catch {
      toast.error('Erro ao salvar rascunho')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (submittingRef.current || !allRequiredValid) return
    submittingRef.current = true
    setSubmitting(true)
    try {
      if (isEditing && id) {
        await updateRequisition(id, buildPayload('Aguardando aprovação'))
        toast.success('Requisição enviada para aprovação!')
      } else {
        await createRequisition({ ...buildPayload('Aguardando aprovação'), solicitante: user?.id })
        toast.success('Requisição enviada para aprovação!')
      }
      navigate('/requisicoes')
    } catch {
      toast.error('Erro ao enviar requisição')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const clienteOpts = useMemo(
    () => clientes.map((c) => ({ value: c.id, label: c.nome })),
    [clientes],
  )
  const cargoOpts = useMemo(() => cargos.map((c) => ({ value: c.id, label: c.nome })), [cargos])
  const cidadeOpts = useMemo(() => cidades.map((c) => ({ value: c.id, label: c.nome })), [cidades])
  const tipoVagaOpts = useMemo(
    () => tiposVaga.map((t) => ({ value: t.id, label: t.nome })),
    [tiposVaga],
  )
  const tipoContratoOpts = useMemo(
    () => tiposContrato.map((t) => ({ value: t.id, label: t.nome })),
    [tiposContrato],
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Button variant="ghost" onClick={() => navigate('/requisicoes')} className="text-slate-600">
        <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para Requisições
      </Button>

      <Card className="border-slate-200 shadow-md">
        <CardHeader className="bg-slate-50/80 border-b border-slate-200">
          <CardTitle className="text-xl font-bold text-slate-900">
            {isEditing ? 'Editar Requisição' : 'Nova Requisição de Vaga'}
          </CardTitle>
          <div className="flex items-center gap-2 mt-4">
            {WIZARD_STEPS.map((s, i) => (
              <div key={s.num} className="flex items-center flex-1">
                <div
                  className={cn(
                    'flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold shrink-0 transition-colors',
                    step > s.num
                      ? 'bg-emerald-600 text-white'
                      : step === s.num
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-200 text-slate-500',
                  )}
                >
                  {step > s.num ? <Check className="h-4 w-4" /> : s.num}
                </div>
                <span
                  className={cn(
                    'ml-2 text-xs font-medium hidden sm:block',
                    step >= s.num ? 'text-slate-800' : 'text-slate-400',
                  )}
                >
                  {s.title}
                </span>
                {i < WIZARD_STEPS.length - 1 && (
                  <div
                    className={cn(
                      'flex-1 h-0.5 mx-2 rounded',
                      step > s.num ? 'bg-emerald-500' : 'bg-slate-200',
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-4">
          {step === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Departamento <span className="text-rose-500">*</span>
                </Label>
                <Select value={form.departamento} onValueChange={(v) => set('departamento', v)}>
                  <SelectTrigger className={errors.departamento ? 'border-rose-500' : ''}>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTAMENTO_OPTIONS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.departamento && (
                  <p className="text-[11px] text-rose-500">{errors.departamento}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Cliente <span className="text-rose-500">*</span>
                </Label>
                <Combobox
                  options={clienteOpts}
                  value={form.cliente}
                  onChange={(v) => set('cliente', v)}
                  placeholder="Selecionar..."
                  className={errors.cliente ? 'border-rose-500' : ''}
                />
                {errors.cliente && <p className="text-[11px] text-rose-500">{errors.cliente}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Cargo <span className="text-rose-500">*</span>
                </Label>
                <Combobox
                  options={cargoOpts}
                  value={form.cargo}
                  onChange={(v) => set('cargo', v)}
                  placeholder="Selecionar..."
                  className={errors.cargo ? 'border-rose-500' : ''}
                />
                {errors.cargo && <p className="text-[11px] text-rose-500">{errors.cargo}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Cidade <span className="text-rose-500">*</span>
                </Label>
                <Combobox
                  options={cidadeOpts}
                  value={form.cidade}
                  onChange={(v) => set('cidade', v)}
                  placeholder="Selecionar..."
                  className={errors.cidade ? 'border-rose-500' : ''}
                />
                {errors.cidade && <p className="text-[11px] text-rose-500">{errors.cidade}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Tipo de Vaga <span className="text-rose-500">*</span>
                </Label>
                <Combobox
                  options={tipoVagaOpts}
                  value={form.tipo_vaga}
                  onChange={(v) => set('tipo_vaga', v)}
                  placeholder="Selecionar..."
                  className={errors.tipo_vaga ? 'border-rose-500' : ''}
                />
                {errors.tipo_vaga && (
                  <p className="text-[11px] text-rose-500">{errors.tipo_vaga}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Tipo de Contrato <span className="text-rose-500">*</span>
                </Label>
                <Combobox
                  options={tipoContratoOpts}
                  value={form.tipo_contrato}
                  onChange={(v) => set('tipo_contrato', v)}
                  placeholder="Selecionar..."
                  className={errors.tipo_contrato ? 'border-rose-500' : ''}
                />
                {errors.tipo_contrato && (
                  <p className="text-[11px] text-rose-500">{errors.tipo_contrato}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Quantidade de Vagas <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={form.quantidade_vagas}
                  onChange={(e) => set('quantidade_vagas', Number(e.target.value))}
                  className={errors.quantidade_vagas ? 'border-rose-500' : ''}
                />
                {errors.quantidade_vagas && (
                  <p className="text-[11px] text-rose-500">{errors.quantidade_vagas}</p>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Prioridade <span className="text-rose-500">*</span>
                </Label>
                <Select value={form.prioridade} onValueChange={(v) => set('prioridade', v)}>
                  <SelectTrigger className={errors.prioridade ? 'border-rose-500' : ''}>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Alta">Alta</SelectItem>
                    <SelectItem value="Média">Média</SelectItem>
                    <SelectItem value="Baixa">Baixa</SelectItem>
                  </SelectContent>
                </Select>
                {errors.prioridade && (
                  <p className="text-[11px] text-rose-500">{errors.prioridade}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Faixa Salarial</Label>
                <Input
                  placeholder="Ex: R$ 2.000 - R$ 3.000"
                  value={form.faixa_salarial}
                  onChange={(e) => set('faixa_salarial', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Prazo Desejado</Label>
                <Input
                  type="date"
                  value={form.prazo_desejado}
                  onChange={(e) => set('prazo_desejado', e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-semibold text-slate-700">Especificações</Label>
                <Textarea
                  rows={3}
                  placeholder="Requisitos, competências, formação..."
                  value={form.especificacoes}
                  onChange={(e) => set('especificacoes', e.target.value)}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Justificativa <span className="text-rose-500">*</span>
                </Label>
                <Textarea
                  rows={4}
                  placeholder="Descreva a necessidade da vaga..."
                  value={form.justificativa}
                  onChange={(e) => set('justificativa', e.target.value)}
                  className={errors.justificativa ? 'border-rose-500' : ''}
                />
                {errors.justificativa && (
                  <p className="text-[11px] text-rose-500">{errors.justificativa}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Observações Internas</Label>
                <Textarea
                  rows={2}
                  placeholder="Anotações internas..."
                  value={form.observacoes_internas}
                  onChange={(e) => set('observacoes_internas', e.target.value)}
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-800 mb-2">
                Revise os dados antes de enviar
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {[
                  [
                    'Departamento',
                    form.departamento
                      ? DEPARTAMENTO_LABELS[form.departamento as RequisitionDepartamento]
                      : '—',
                  ],
                  ['Cliente', clientes.find((c) => c.id === form.cliente)?.nome || '—'],
                  ['Cargo', cargos.find((c) => c.id === form.cargo)?.nome || '—'],
                  ['Cidade', cidades.find((c) => c.id === form.cidade)?.nome || '—'],
                  ['Tipo de Vaga', tiposVaga.find((t) => t.id === form.tipo_vaga)?.nome || '—'],
                  [
                    'Tipo de Contrato',
                    tiposContrato.find((t) => t.id === form.tipo_contrato)?.nome || '—',
                  ],
                  ['Quantidade de Vagas', String(form.quantidade_vagas)],
                  ['Prioridade', form.prioridade || '—'],
                  ['Faixa Salarial', form.faixa_salarial || '—'],
                  ['Prazo Desejado', form.prazo_desejado || '—'],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex justify-between border-b border-slate-100 py-1.5"
                  >
                    <span className="text-slate-500 text-xs">{label}</span>
                    <span className="font-medium text-slate-800 text-xs text-right">{value}</span>
                  </div>
                ))}
                <div className="sm:col-span-2 border-b border-slate-100 py-1.5">
                  <span className="text-slate-500 text-xs block mb-1">Justificativa</span>
                  <span className="text-slate-800 text-xs">{form.justificativa || '—'}</span>
                </div>
                {form.especificacoes && (
                  <div className="sm:col-span-2 border-b border-slate-100 py-1.5">
                    <span className="text-slate-500 text-xs block mb-1">Especificações</span>
                    <span className="text-slate-800 text-xs">{form.especificacoes}</span>
                  </div>
                )}
                {form.observacoes_internas && (
                  <div className="sm:col-span-2 py-1.5">
                    <span className="text-slate-500 text-xs block mb-1">Observações Internas</span>
                    <span className="text-slate-800 text-xs">{form.observacoes_internas}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="bg-slate-50 border-t border-slate-200 p-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
              </Button>
            )}
            {step < 4 && (
              <Button onClick={handleNext} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                Avançar <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleSaveDraft} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar Rascunho'}
            </Button>
            {step === 4 && (
              <Button
                onClick={handleSubmit}
                disabled={submitting || !allRequiredValid}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                <Send className="h-4 w-4 mr-2" />
                {submitting ? 'Enviando...' : 'Enviar para Aprovação'}
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
