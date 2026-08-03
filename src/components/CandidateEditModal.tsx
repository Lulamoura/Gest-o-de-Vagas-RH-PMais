import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { StarRating } from '@/components/StarRating'
import { CurrencyInput } from '@/components/CurrencyInput'
import { ExamReferralModal } from '@/components/ExamReferralModal'
import { IntegrationNoticeModal } from '@/components/IntegrationNoticeModal'
import {
  createCandidate,
  updateCandidate,
  sendComplementDataRequest,
  sendDisqualificationNotice,
  sendAvisoIntegracaoCandidato,
} from '@/services/candidates'
import { getEmailLogsForCandidate, hasEmailBeenSent } from '@/services/candidate_email_logs'
import { getBaseIntegracao } from '@/services/base_integracao'
import { getClinicas } from '@/services/clinicas'
import {
  CandidateRecord,
  VacancyRecord,
  ClinicaRecord,
  BaseIntegracaoRecord,
  CandidateStatus,
  CandidateEmailLogRecord,
} from '@/types'
import { useAuth } from '@/hooks/use-auth'
import { toDateInputValue } from '@/lib/status-utils'
import { isCandidateStatusEnabled } from '@/lib/candidate-validation'
import { toast } from 'sonner'
import { Mail, Stethoscope, Check, Video } from 'lucide-react'

const ALL_STATUSES: CandidateStatus[] = [
  'Análise do RH',
  'Análise do gestor',
  'Documentação e exame',
  'Cadastro DP',
  'Integrado',
  'Desistente',
  'Desclassificado',
  'Em banco',
]

const COMPLEMENT_STATUSES: CandidateStatus[] = [
  'Análise do RH',
  'Análise do gestor',
  'Documentação e exame',
]
const DISQUALIFICATION_STATUSES: CandidateStatus[] = ['Desclassificado', 'Em banco']

interface FormData {
  vacancy_id: string
  nome: string
  email: string
  telefone: string
  cpf: string
  cidade: string
  bairro: string
  status_candidato: CandidateStatus
  rank: number
  rg: string
  tamanho_fardamento: string
  tamanho_sapato: string
  vale_transporte_qtd: number
  valor_unitario_transporte: number
  nome_pai: string
  nome_mae: string
  telefone_emergencia: string
  data_nascimento: string
  observacao: string
  ordem_execucao: string
  custo_consultas: number
  custo_exames: number
  custo_testes: number
  custo_extras: number
  integracao_ativa: boolean
  data_integracao: string
  hora_integracao: string
  tipo_integracao: string
}

const defaultForm = (vacancyId?: string): FormData => ({
  vacancy_id: vacancyId || '',
  nome: '',
  email: '',
  telefone: '',
  cpf: '',
  cidade: '',
  bairro: '',
  status_candidato: 'Análise do RH',
  rank: 0,
  rg: '',
  tamanho_fardamento: '',
  tamanho_sapato: '',
  vale_transporte_qtd: 0,
  valor_unitario_transporte: 0,
  nome_pai: '',
  nome_mae: '',
  telefone_emergencia: '',
  data_nascimento: '',
  observacao: '',
  ordem_execucao: '',
  custo_consultas: 0,
  custo_exames: 0,
  custo_testes: 0,
  custo_extras: 0,
  integracao_ativa: false,
  data_integracao: '',
  hora_integracao: '',
  tipo_integracao: 'Presencial',
})

interface CandidateEditModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidate: CandidateRecord | null
  vacancies: VacancyRecord[]
  fixedVacancyId?: string
  onSaved: () => void
}

export function CandidateEditModal({
  open,
  onOpenChange,
  candidate,
  vacancies,
  fixedVacancyId,
  onSaved,
}: CandidateEditModalProps) {
  const { isAdmin, isSuperAdmin } = useAuth()
  const canEdit = isAdmin || isSuperAdmin

  const [formData, setFormData] = useState<FormData>(defaultForm(fixedVacancyId))
  const [saving, setSaving] = useState(false)
  const [clinicas, setClinicas] = useState<ClinicaRecord[]>([])
  const [baseIntegracao, setBaseIntegracao] = useState<BaseIntegracaoRecord[]>([])
  const [emailLogs, setEmailLogs] = useState<CandidateEmailLogRecord[]>([])
  const [sendingEmail, setSendingEmail] = useState(false)
  const [sendingDisqual, setSendingDisqual] = useState(false)
  const [sendingIntegration, setSendingIntegration] = useState(false)
  const [examModalOpen, setExamModalOpen] = useState(false)
  const [integrationModalOpen, setIntegrationModalOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    if (candidate) {
      setFormData({
        vacancy_id: candidate.vacancy_id || fixedVacancyId || '',
        nome: candidate.nome || '',
        email: candidate.email || '',
        telefone: candidate.telefone || '',
        cpf: candidate.cpf || '',
        cidade: candidate.cidade || '',
        bairro: candidate.bairro || '',
        status_candidato: candidate.status_candidato || 'Análise do RH',
        rank: candidate.rank || 0,
        rg: candidate.rg || '',
        tamanho_fardamento: candidate.tamanho_fardamento || '',
        tamanho_sapato: candidate.tamanho_sapato || '',
        vale_transporte_qtd: candidate.vale_transporte_qtd || 0,
        valor_unitario_transporte: candidate.valor_unitario_transporte || 0,
        nome_pai: candidate.nome_pai || '',
        nome_mae: candidate.nome_mae || '',
        telefone_emergencia: candidate.telefone_emergencia || '',
        data_nascimento: toDateInputValue(candidate.data_nascimento),
        observacao: candidate.observacao || '',
        ordem_execucao: candidate.ordem_execucao || '',
        custo_consultas: candidate.custo_consultas || 0,
        custo_exames: candidate.custo_exames || 0,
        custo_testes: candidate.custo_testes || 0,
        custo_extras: candidate.custo_extras || 0,
        integracao_ativa: candidate.integracao_ativa || false,
        data_integracao: toDateInputValue(candidate.data_integracao),
        hora_integracao: candidate.hora_integracao || '',
        tipo_integracao: candidate.tipo_integracao || 'Presencial',
      })
      getEmailLogsForCandidate(candidate.id)
        .then(setEmailLogs)
        .catch(() => {})
    } else {
      setFormData(defaultForm(fixedVacancyId))
      setEmailLogs([])
    }
  }, [candidate, open, fixedVacancyId])

  useEffect(() => {
    if (!open) return
    getClinicas()
      .then(setClinicas)
      .catch(() => {})
    getBaseIntegracao()
      .then(setBaseIntegracao)
      .catch(() => {})
  }, [open])

  const update = (field: keyof FormData, value: unknown) =>
    setFormData((prev) => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    if (!formData.nome.trim()) {
      toast.error('O nome é obrigatório.')
      return
    }
    if (!formData.vacancy_id) {
      toast.error('Selecione uma vaga.')
      return
    }
    if (formData.integracao_ativa && !formData.data_integracao) {
      toast.error('A Data da Integração é obrigatória.')
      return
    }
    setSaving(true)
    try {
      const data: Partial<CandidateRecord> = {
        ...formData,
        rank: formData.rank || undefined,
        tamanho_fardamento: formData.tamanho_fardamento || undefined,
        data_nascimento: formData.data_nascimento || undefined,
        data_integracao: formData.integracao_ativa ? formData.data_integracao : '',
      }
      if (candidate) {
        await updateCandidate(candidate.id, data)
        toast.success('Candidato salvo com sucesso!')
      } else {
        await createCandidate(data)
        toast.success('Candidato criado com sucesso!')
      }
      onOpenChange(false)
      onSaved()
    } catch {
      toast.error('Erro ao salvar candidato.')
    } finally {
      setSaving(false)
    }
  }

  const refreshLogs = async () => {
    if (!candidate) return
    try {
      const logs = await getEmailLogsForCandidate(candidate.id)
      setEmailLogs(logs)
    } catch {
      /* noop */
    }
  }

  const handleSendComplement = async () => {
    if (!candidate) return
    setSendingEmail(true)
    try {
      await sendComplementDataRequest(candidate.id)
      toast.success('E-mail enviado!')
      await refreshLogs()
    } catch {
      toast.error('Erro ao enviar e-mail')
    } finally {
      setSendingEmail(false)
    }
  }

  const handleSendDisqual = async () => {
    if (!candidate) return
    setSendingDisqual(true)
    try {
      await sendDisqualificationNotice(candidate.id)
      toast.success('Aviso enviado!')
      await refreshLogs()
    } catch {
      toast.error('Erro ao enviar e-mail')
    } finally {
      setSendingDisqual(false)
    }
  }

  const handleSendIntegration = async (baseId?: string) => {
    if (!candidate) return
    setSendingIntegration(true)
    try {
      await sendAvisoIntegracaoCandidato(candidate.id, baseId)
      toast.success('Aviso de integração enviado!')
      setIntegrationModalOpen(false)
      await refreshLogs()
    } catch {
      toast.error('Erro ao enviar e-mail')
    } finally {
      setSendingIntegration(false)
    }
  }

  const currentStatus = formData.status_candidato
  const showComplementBtn = canEdit && candidate && COMPLEMENT_STATUSES.includes(currentStatus)
  const showExamBtn = canEdit && candidate && currentStatus === 'Documentação e exame'
  const showDisqualBtn = canEdit && candidate && DISQUALIFICATION_STATUSES.includes(currentStatus)
  const showIntegrationBtn = canEdit && candidate && formData.integracao_ativa
  const isStatusEnabled = isCandidateStatusEnabled({
    nome: formData.nome,
    email: formData.email,
    telefone: formData.telefone,
    cpf: formData.cpf,
    cidade: formData.cidade,
    bairro: formData.bairro,
    vacancy_id: formData.vacancy_id,
    ordem_execucao: formData.ordem_execucao,
  })

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {candidate ? `Editar Candidato - ${candidate.nome}` : 'Novo Candidato'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">
                  Nome Completo <span className="text-rose-500">*</span>
                </Label>
                <Input value={formData.nome} onChange={(e) => update('nome', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">
                  Vaga <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={formData.vacancy_id}
                  onValueChange={(v) => update('vacancy_id', v)}
                  disabled={!!fixedVacancyId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma vaga" />
                  </SelectTrigger>
                  <SelectContent>
                    {vacancies.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.expand?.cargo?.nome || v.expand?.cliente?.nome || v.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">E-mail</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => update('email', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Telefone</Label>
                <Input
                  value={formData.telefone}
                  onChange={(e) => update('telefone', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">CPF</Label>
                <Input value={formData.cpf} onChange={(e) => update('cpf', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Status no Pipeline</Label>
                <Select
                  value={formData.status_candidato}
                  onValueChange={(v) => update('status_candidato', v as CandidateStatus)}
                  disabled={!isStatusEnabled}
                >
                  <SelectTrigger disabled={!isStatusEnabled}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Cidade</Label>
                <Input value={formData.cidade} onChange={(e) => update('cidade', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Bairro</Label>
                <Input value={formData.bairro} onChange={(e) => update('bairro', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">O.E — Ordem de Execução</Label>
                <Input
                  value={formData.ordem_execucao}
                  onChange={(e) => update('ordem_execucao', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Ranking (1-5 estrelas)</Label>
                <StarRating
                  value={formData.rank || null}
                  onChange={(v) => update('rank', v ?? 0)}
                  size={24}
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                Dados Complementares
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">RG</Label>
                  <Input value={formData.rg} onChange={(e) => update('rg', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Tamanho Fardamento</Label>
                  <Select
                    value={formData.tamanho_fardamento}
                    onValueChange={(v) => update('tamanho_fardamento', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {['PP', 'P', 'M', 'G', 'GG'].map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Tamanho Sapato</Label>
                  <Input
                    value={formData.tamanho_sapato}
                    onChange={(e) => update('tamanho_sapato', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">
                    Vale-transporte (qtd/dia)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.vale_transporte_qtd}
                    onChange={(e) =>
                      update('vale_transporte_qtd', parseInt(e.target.value, 10) || 0)
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">
                    Valor Unitário Transporte
                  </Label>
                  <CurrencyInput
                    value={formData.valor_unitario_transporte || 0}
                    onChange={(v) => update('valor_unitario_transporte', v)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Data de Nascimento</Label>
                  <Input
                    type="date"
                    value={formData.data_nascimento}
                    onChange={(e) => update('data_nascimento', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Nome do Pai</Label>
                  <Input
                    value={formData.nome_pai}
                    onChange={(e) => update('nome_pai', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Nome da Mãe</Label>
                  <Input
                    value={formData.nome_mae}
                    onChange={(e) => update('nome_mae', e.target.value)}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs font-bold text-slate-700">
                    Telefone para Emergência
                  </Label>
                  <Input
                    value={formData.telefone_emergencia}
                    onChange={(e) => update('telefone_emergencia', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                Custos (R$)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-500">Consultas</Label>
                  <CurrencyInput
                    value={formData.custo_consultas}
                    onChange={(v) => update('custo_consultas', v)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-500">Exames</Label>
                  <CurrencyInput
                    value={formData.custo_exames}
                    onChange={(v) => update('custo_exames', v)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-500">Testes</Label>
                  <CurrencyInput
                    value={formData.custo_testes}
                    onChange={(v) => update('custo_testes', v)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-500">Extras</Label>
                  <CurrencyInput
                    value={formData.custo_extras}
                    onChange={(v) => update('custo_extras', v)}
                  />
                </div>
              </div>
            </div>

            {canEdit && (
              <div className="pt-3 border-t border-slate-200">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Observações</Label>
                  <Textarea
                    value={formData.observacao}
                    onChange={(e) => update('observacao', e.target.value)}
                    placeholder="Adicione observações sobre o candidato..."
                    rows={2}
                  />
                </div>
              </div>
            )}

            {canEdit && formData.status_candidato === 'Cadastro DP' && (
              <div className="pt-3 border-t border-slate-200">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                  Integração
                </h4>
                <div className="flex items-center gap-3 mb-3">
                  <Checkbox
                    checked={formData.integracao_ativa}
                    onCheckedChange={(c) => {
                      const isChecked = c === true
                      update('integracao_ativa', isChecked)
                      if (!isChecked) {
                        update('data_integracao', '')
                        update('hora_integracao', '')
                      }
                    }}
                  />
                  <Label className="text-xs font-bold text-slate-700 cursor-pointer">
                    Ativar Integração
                  </Label>
                </div>
                {formData.integracao_ativa && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-700">
                        Data <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        type="date"
                        value={formData.data_integracao}
                        onChange={(e) => update('data_integracao', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-700">Hora</Label>
                      <Input
                        type="time"
                        value={formData.hora_integracao}
                        onChange={(e) => update('hora_integracao', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-700">Tipo</Label>
                      <Select
                        value={formData.tipo_integracao}
                        onValueChange={(v) => update('tipo_integracao', v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Presencial">Presencial</SelectItem>
                          <SelectItem value="On-line">On-line</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {(showComplementBtn || showExamBtn || showDisqualBtn || showIntegrationBtn) && (
              <div className="pt-3 border-t border-slate-200 space-y-2">
                {showComplementBtn && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendComplement}
                    disabled={sendingEmail || !formData.email}
                    className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {sendingEmail ? 'Enviando...' : 'Solicitar dados complementares'}
                    {hasEmailBeenSent(emailLogs, 'complement_data') && (
                      <Check className="h-4 w-4 ml-2 text-emerald-600" />
                    )}
                  </Button>
                )}
                {showExamBtn && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setExamModalOpen(true)}
                    disabled={!formData.email}
                    className="w-full border-purple-200 text-purple-700 hover:bg-purple-50"
                  >
                    <Stethoscope className="h-4 w-4 mr-2" />
                    Enviar Informações para Exames
                    {hasEmailBeenSent(emailLogs, 'encaminhamento_exames') && (
                      <Check className="h-4 w-4 ml-2 text-emerald-600" />
                    )}
                  </Button>
                )}
                {showDisqualBtn && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendDisqual}
                    disabled={sendingDisqual || !formData.email}
                    className="w-full border-amber-200 text-amber-700 hover:bg-amber-50"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {sendingDisqual ? 'Enviando...' : 'Aviso de Desclassificação/Banco'}
                    {hasEmailBeenSent(emailLogs, 'disqualification') && (
                      <Check className="h-4 w-4 ml-2 text-emerald-600" />
                    )}
                  </Button>
                )}
                {showIntegrationBtn && (
                  <>
                    {formData.tipo_integracao === 'On-line' && (
                      <p className="text-xs text-slate-500 text-center flex items-center justify-center gap-1">
                        <Video className="h-3.5 w-3.5" />
                        Integração On-line — o link será enviado no e-mail do candidato.
                      </p>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        formData.tipo_integracao === 'Presencial'
                          ? setIntegrationModalOpen(true)
                          : handleSendIntegration()
                      }
                      disabled={sendingIntegration || !formData.email}
                      className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      {sendingIntegration ? 'Enviando...' : 'Enviar Aviso de Integração'}
                      {hasEmailBeenSent(emailLogs, 'aviso_integracao_candidato') && (
                        <Check className="h-4 w-4 ml-2 text-emerald-600" />
                      )}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExamReferralModal
        open={examModalOpen}
        onOpenChange={setExamModalOpen}
        candidate={candidate}
        clinicas={clinicas}
        onSuccess={onSaved}
      />
      <IntegrationNoticeModal
        open={integrationModalOpen}
        onOpenChange={setIntegrationModalOpen}
        baseIntegracao={baseIntegracao}
        onSend={handleSendIntegration}
        sending={sendingIntegration}
      />
    </>
  )
}
