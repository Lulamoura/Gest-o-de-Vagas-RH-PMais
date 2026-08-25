import { useState, useEffect, useMemo } from 'react'
import {
  getCandidates,
  createCandidate,
  updateCandidate,
  deleteCandidate,
  sendComplementDataRequest,
  sendDisqualificationNotice,
  sendAvisoIntegracaoCandidato,
} from '@/services/candidates'
import { computeReturningCounts } from '@/services/candidate_returning'
import { getVacancies } from '@/services/vacancies'
import { getClinicas } from '@/services/clinicas'
import { getTiposVaga } from '@/services/tipos_vaga'
import { getTiposContrato } from '@/services/tipos_contrato'
import { getEmailLogsForCandidate, hasEmailBeenSent } from '@/services/candidate_email_logs'
import { getLatestCandidateHistory } from '@/services/candidate_history'
import {
  CandidateRecord,
  CandidateHistoryRecord,
  VacancyRecord,
  CandidateStatus,
  VacancyStatus,
  ClinicaRecord,
  CandidateEmailLogRecord,
  TipoVagaRecord,
  TipoContratoRecord,
} from '@/types'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { useSystemParameters } from '@/hooks/use-system-parameters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StarRating } from '@/components/StarRating'
import { ExamReferralModal } from '@/components/ExamReferralModal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { getCandidateStatusBadgeClass, toDateInputValue, formatDateBR } from '@/lib/status-utils'
import { Checkbox } from '@/components/ui/checkbox'
import { CurrencyInput } from '@/components/CurrencyInput'
import { toast } from 'sonner'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Mail,
  Stethoscope,
  Check,
  Eye,
  User,
  RotateCcw,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { OverdueVacancyIcon } from '@/components/OverdueVacancyIcon'
import { isVacancyOverdue } from '@/lib/vacancy-overdue'

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

export default function Candidates() {
  const navigate = useNavigate()
  const { isAdmin, isSuperAdmin } = useAuth()
  const { parameters } = useSystemParameters()
  const alertThreshold = parameters?.prazo_alerta_dias ?? 30
  const canEdit = isAdmin || isSuperAdmin

  const [candidates, setCandidates] = useState<CandidateRecord[]>([])
  const [vacancies, setVacancies] = useState<VacancyRecord[]>([])
  const [clinicas, setClinicas] = useState<ClinicaRecord[]>([])
  const [tiposVaga, setTiposVaga] = useState<TipoVagaRecord[]>([])
  const [tiposContrato, setTiposContrato] = useState<TipoContratoRecord[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [vacancyFilter, setVacancyFilter] = useState<string>('all')
  const [vacancyStatusFilter, setVacancyStatusFilter] = useState<VacancyStatus | 'all'>('Aberta')
  const [tipoVagaFilter, setTipoVagaFilter] = useState<string>('all')
  const [tipoContratoFilter, setTipoContratoFilter] = useState<string>('all')

  const [editOpen, setEditOpen] = useState(false)
  const [editingCandidate, setEditingCandidate] = useState<CandidateRecord | null>(null)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState<{
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
    nome_pai: string
    nome_mae: string
    telefone_emergencia: string
    integracao_ativa: boolean
    data_integracao: string
    hora_integracao: string
    tipo_integracao: 'Presencial' | 'On-line' | ''
    valor_unitario_transporte: number
    data_nascimento: string
    informacoes_integracao: string
    tipo_vaga: string
    tipo_contrato: string
  }>({
    vacancy_id: '',
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
    nome_pai: '',
    nome_mae: '',
    telefone_emergencia: '',
    integracao_ativa: false,
    data_integracao: '',
    hora_integracao: '',
    tipo_integracao: '',
    valor_unitario_transporte: 0,
    data_nascimento: '',
    informacoes_integracao: '',
    tipo_vaga: '',
    tipo_contrato: '',
  })

  const [emailLogs, setEmailLogs] = useState<CandidateEmailLogRecord[]>([])
  const [sendingEmail, setSendingEmail] = useState(false)
  const [sendingDisqual, setSendingDisqual] = useState(false)
  const [sendingIntegration, setSendingIntegration] = useState(false)
  const [examModalOpen, setExamModalOpen] = useState(false)
  const [latestStatusHistory, setLatestStatusHistory] = useState<CandidateHistoryRecord | null>(
    null,
  )
  const [loadingHistory, setLoadingHistory] = useState(false)

  const [candidateToDelete, setCandidateToDelete] = useState<CandidateRecord | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const loadData = async () => {
    try {
      const [cList, vList, clList, tvList, tcList] = await Promise.all([
        getCandidates(),
        getVacancies(),
        getClinicas(),
        getTiposVaga().catch(() => []),
        getTiposContrato().catch(() => []),
      ])
      setCandidates(cList)
      setVacancies(vList)
      setClinicas(clList)
      setTiposVaga(tvList)
      setTiposContrato(tcList)
    } catch {
      toast.error('Erro ao carregar candidatos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('candidates', () => loadData())

  const openNewModal = () => {
    setEditingCandidate(null)
    setEmailLogs([])
    setLatestStatusHistory(null)
    setLoadingHistory(false)
    setFormData({
      vacancy_id: vacancies[0]?.id || '',
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
      nome_pai: '',
      nome_mae: '',
      telefone_emergencia: '',
      integracao_ativa: false,
      data_integracao: '',
      hora_integracao: '',
      tipo_integracao: '',
      valor_unitario_transporte: 0,
      data_nascimento: '',
      informacoes_integracao: '',
      tipo_vaga: '',
      tipo_contrato: '',
    })
    setEditOpen(true)
  }

  const openEditModal = async (c: CandidateRecord) => {
    setEditingCandidate(c)
    setLatestStatusHistory(null)
    setLoadingHistory(true)
    getLatestCandidateHistory(c.id)
      .then((rec) => setLatestStatusHistory(rec))
      .catch(() => setLatestStatusHistory(null))
      .finally(() => setLoadingHistory(false))
    setFormData({
      vacancy_id: c.vacancy_id || '',
      nome: c.nome || '',
      email: c.email || '',
      telefone: c.telefone || '',
      cpf: c.cpf || '',
      cidade: c.cidade || '',
      bairro: c.bairro || '',
      status_candidato: c.status_candidato || 'Análise do RH',
      rank: c.rank || 0,
      rg: c.rg || '',
      tamanho_fardamento: c.tamanho_fardamento || '',
      tamanho_sapato: c.tamanho_sapato || '',
      vale_transporte_qtd: c.vale_transporte_qtd || 0,
      nome_pai: c.nome_pai || '',
      nome_mae: c.nome_mae || '',
      telefone_emergencia: c.telefone_emergencia || '',
      integracao_ativa: c.integracao_ativa || false,
      data_integracao: toDateInputValue(c.data_integracao),
      hora_integracao: c.hora_integracao || '',
      tipo_integracao: c.tipo_integracao || '',
      valor_unitario_transporte: c.valor_unitario_transporte || 0,
      data_nascimento: toDateInputValue(c.data_nascimento),
      informacoes_integracao: c.informacoes_integracao || '',
      tipo_vaga: c.tipo_vaga || '',
      tipo_contrato: c.tipo_contrato || '',
    })
    setEditOpen(true)

    try {
      const logs = await getEmailLogsForCandidate(c.id)
      setEmailLogs(logs)
    } catch {
      setEmailLogs([])
    }
  }

  const handleSave = async () => {
    if (!formData.nome.trim()) {
      toast.error('O nome é obrigatório.')
      return
    }
    if (!formData.vacancy_id) {
      toast.error('Selecione uma vaga para o candidato.')
      return
    }
    if (formData.integracao_ativa && !formData.data_integracao) {
      toast.error('A Data da Integração é obrigatória quando a integração está ativada.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        ...formData,
        tipo_integracao: formData.tipo_integracao || undefined,
      }
      if (editingCandidate) {
        const updated = await updateCandidate(editingCandidate.id, payload)
        setEditingCandidate(updated)
        getLatestCandidateHistory(editingCandidate.id)
          .then((rec) => setLatestStatusHistory(rec))
          .catch(() => {})
        toast.success('Candidato salvo com sucesso!')
      } else {
        const created = await createCandidate(payload)
        setEditingCandidate(created)
        toast.success('Candidato criado e salvo com sucesso!')
      }
      loadData()
    } catch {
      toast.error('Erro ao salvar candidato.')
    } finally {
      setSaving(false)
    }
  }

  const promptDelete = (c: CandidateRecord) => {
    setCandidateToDelete(c)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!candidateToDelete) return
    setDeleting(true)
    try {
      await deleteCandidate(candidateToDelete.id)
      toast.success('Candidato excluído!')
      setDeleteDialogOpen(false)
      setCandidateToDelete(null)
      loadData()
    } catch {
      toast.error('Erro ao excluir candidato')
    } finally {
      setDeleting(false)
    }
  }

  const handleSendEmail = async () => {
    if (!editingCandidate) return
    setSendingEmail(true)
    try {
      await sendComplementDataRequest(editingCandidate.id)
      toast.success('E-mail de dados complementares enviado!')
      const logs = await getEmailLogsForCandidate(editingCandidate.id)
      setEmailLogs(logs)
    } catch {
      toast.error('Erro ao enviar e-mail')
    } finally {
      setSendingEmail(false)
    }
  }

  const handleSendDisqualification = async () => {
    if (!editingCandidate) return
    setSendingDisqual(true)
    try {
      await sendDisqualificationNotice(editingCandidate.id)
      toast.success('Aviso enviado com sucesso!')
      const logs = await getEmailLogsForCandidate(editingCandidate.id)
      setEmailLogs(logs)
    } catch {
      toast.error('Erro ao enviar e-mail')
    } finally {
      setSendingDisqual(false)
    }
  }

  const handleSendIntegration = async () => {
    if (!editingCandidate) return
    setSendingIntegration(true)
    try {
      await sendAvisoIntegracaoCandidato(editingCandidate.id)
      toast.success('Aviso de integração enviado!')
      const logs = await getEmailLogsForCandidate(editingCandidate.id)
      setEmailLogs(logs)
    } catch {
      toast.error('Erro ao enviar e-mail')
    } finally {
      setSendingIntegration(false)
    }
  }

  const returningCounts = useMemo(() => {
    return computeReturningCounts(candidates)
  }, [candidates])

  const filteredCandidates = candidates.filter((c) => {
    const matchesSearch =
      !search ||
      c.nome.toLowerCase().includes(search.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
      (c.cpf && c.cpf.includes(search))

    const matchesStatus = statusFilter === 'all' || c.status_candidato === statusFilter
    const matchesVacancy = vacancyFilter === 'all' || c.vacancy_id === vacancyFilter
    const matchesVacancyStatus =
      vacancyStatusFilter === 'all' ||
      (c.vacancy_id != null && c.expand?.vacancy_id?.status_vaga === vacancyStatusFilter)
    const matchesTipoVaga = tipoVagaFilter === 'all' || c.tipo_vaga === tipoVagaFilter
    const matchesTipoContrato =
      tipoContratoFilter === 'all' || c.tipo_contrato === tipoContratoFilter

    return (
      matchesSearch &&
      matchesStatus &&
      matchesVacancy &&
      matchesVacancyStatus &&
      matchesTipoVaga &&
      matchesTipoContrato
    )
  })

  const currentStatus = formData.status_candidato
  const showComplementBtn = canEdit && editingCandidate && currentStatus === 'Análise do gestor'
  const showExamBtn = canEdit && editingCandidate && currentStatus === 'Documentação e exame'
  const showDisqualBtn =
    canEdit &&
    editingCandidate &&
    (currentStatus === 'Desclassificado' || currentStatus === 'Em banco')
  const showIntegrationBtn =
    canEdit && editingCandidate && currentStatus === 'Cadastro DP' && formData.integracao_ativa

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestão de Candidatos</h1>
          <p className="text-slate-500 text-xs mt-1">
            Cadastre, edite e acompanhe o pipeline de candidatos do RH.
          </p>
        </div>
        {canEdit && (
          <Button
            onClick={openNewModal}
            className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xs"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Candidato
          </Button>
        )}
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por nome, e-mail ou CPF..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>
            <Select value={vacancyFilter} onValueChange={setVacancyFilter}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Todas as vagas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as vagas</SelectItem>
                {vacancies.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.expand?.cargo?.nome || v.expand?.cliente?.nome || v.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {ALL_STATUSES.map((st) => (
                  <SelectItem key={st} value={st}>
                    {st}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={vacancyStatusFilter}
              onValueChange={(val) => setVacancyStatusFilter(val as VacancyStatus | 'all')}
            >
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Status da vaga" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="Aberta">Aberta</SelectItem>
                <SelectItem value="Concluída">Concluída</SelectItem>
                <SelectItem value="Cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tipoVagaFilter} onValueChange={setTipoVagaFilter}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Tipo de Vaga" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {tiposVaga.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tipoContratoFilter} onValueChange={setTipoContratoFilter}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Tipo de Contrato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {tiposContrato.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : filteredCandidates.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="p-8 text-center text-slate-500 text-sm">
            Nenhum candidato encontrado.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCandidates.map((c) => {
            const vacancy = c.expand?.vacancy_id
            return (
              <Card key={c.id} className="border-slate-200 hover:border-slate-300 transition-all">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <CardTitle className="text-base font-bold text-slate-900 line-clamp-1">
                          {c.nome}
                        </CardTitle>
                        {(returningCounts[c.id] || 0) > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="outline"
                                className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] font-medium px-1.5 py-0 inline-flex items-center gap-1 cursor-help shrink-0"
                              >
                                <RotateCcw className="h-2.5 w-2.5" />
                                Retornante
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              Já participou de {returningCounts[c.id]}{' '}
                              {returningCounts[c.id] === 1
                                ? 'processo anterior'
                                : 'processos anteriores'}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        {vacancy && isVacancyOverdue(vacancy, alertThreshold) && (
                          <OverdueVacancyIcon iconClassName="h-3.5 w-3.5" />
                        )}
                        {vacancy?.expand?.cargo?.nome || vacancy?.expand?.cliente?.nome || '—'}
                      </p>
                    </div>
                    {c.rank != null && <StarRating value={c.rank} readOnly size={12} />}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="text-xs space-y-1 text-slate-600">
                    {c.email && <p className="truncate">E-mail: {c.email}</p>}
                    {c.telefone && <p>Tel: {c.telefone}</p>}
                    {c.cpf && <p>CPF: {c.cpf}</p>}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <Badge
                      variant="outline"
                      className={getCandidateStatusBadgeClass(c.status_candidato)}
                    >
                      {c.status_candidato}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/candidatos/${c.id}`)}
                        className="h-7 w-8 p-0 text-slate-500 hover:text-slate-900"
                        title="Ver Detalhes"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(c)}
                            className="h-7 w-8 p-0 text-slate-500 hover:text-indigo-600"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => promptDelete(c)}
                            className="h-7 w-8 p-0 text-slate-500 hover:text-rose-600"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Candidate Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCandidate ? `Editar Candidato - ${editingCandidate.nome}` : 'Novo Candidato'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">
                  Nome Completo <span className="text-rose-500">*</span>
                </Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome do candidato"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">
                  Vaga <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={formData.vacancy_id}
                  onValueChange={(val) => setFormData({ ...formData, vacancy_id: val })}
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
                <Label className="text-xs font-bold text-slate-700">Tipo de Vaga</Label>
                <Select
                  value={formData.tipo_vaga}
                  onValueChange={(val) => setFormData({ ...formData, tipo_vaga: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um tipo de vaga" />
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

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Tipo de Contrato</Label>
                <Select
                  value={formData.tipo_contrato}
                  onValueChange={(val) => setFormData({ ...formData, tipo_contrato: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um tipo de contrato" />
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

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">E-mail</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Tipo de Integração</Label>
                <Select
                  value={formData.tipo_integracao}
                  onValueChange={(val) =>
                    setFormData({
                      ...formData,
                      tipo_integracao: val as 'Presencial' | 'On-line' | '',
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Presencial">Presencial</SelectItem>
                    <SelectItem value="On-line">On-line</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">CPF</Label>
                <Input
                  value={formData.cpf}
                  onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                  placeholder="000.000.000-00"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Status no Pipeline</Label>
                <Select
                  value={formData.status_candidato}
                  onValueChange={(val) =>
                    setFormData({ ...formData, status_candidato: val as CandidateStatus })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_STATUSES.map((st) => (
                      <SelectItem key={st} value={st}>
                        {st}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Cidade</Label>
                <Input
                  value={formData.cidade}
                  onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                  placeholder="Cidade"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Bairro</Label>
                <Input
                  value={formData.bairro}
                  onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                  placeholder="Bairro"
                />
              </div>
            </div>

            {/* Dados Complementares */}
            <div className="pt-3 border-t border-slate-200">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                Dados Complementares
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">RG</Label>
                  <Input
                    value={formData.rg}
                    onChange={(e) => setFormData({ ...formData, rg: e.target.value })}
                    placeholder="Número do RG"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Tamanho Fardamento</Label>
                  <Select
                    value={formData.tamanho_fardamento}
                    onValueChange={(val) => setFormData({ ...formData, tamanho_fardamento: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PP">PP</SelectItem>
                      <SelectItem value="P">P</SelectItem>
                      <SelectItem value="M">M</SelectItem>
                      <SelectItem value="G">G</SelectItem>
                      <SelectItem value="GG">GG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Tamanho Sapato</Label>
                  <Input
                    value={formData.tamanho_sapato}
                    onChange={(e) => setFormData({ ...formData, tamanho_sapato: e.target.value })}
                    placeholder="Ex: 40"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">
                    Vale-transporte (qtd/dia)
                  </Label>
                  <Input
                    type="number"
                    value={formData.vale_transporte_qtd}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        vale_transporte_qtd: parseInt(e.target.value, 10) || 0,
                      })
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Data de Nascimento</Label>
                  <Input
                    type="date"
                    value={formData.data_nascimento}
                    onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">
                    Valor Unitário do Transporte
                  </Label>
                  <CurrencyInput
                    value={formData.valor_unitario_transporte}
                    onChange={(val) => setFormData({ ...formData, valor_unitario_transporte: val })}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Nome do Pai</Label>
                  <Input
                    value={formData.nome_pai}
                    onChange={(e) => setFormData({ ...formData, nome_pai: e.target.value })}
                    placeholder="Nome completo do pai"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Nome da Mãe</Label>
                  <Input
                    value={formData.nome_mae}
                    onChange={(e) => setFormData({ ...formData, nome_mae: e.target.value })}
                    placeholder="Nome completo da mãe"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs font-bold text-slate-700">
                    Telefone para Emergência
                  </Label>
                  <Input
                    value={formData.telefone_emergencia}
                    onChange={(e) =>
                      setFormData({ ...formData, telefone_emergencia: e.target.value })
                    }
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
            </div>

            {/* Integration Section */}
            {canEdit && formData.status_candidato === 'Cadastro DP' && (
              <div className="pt-3 border-t border-slate-200">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                  Integração
                </h4>
                <div className="flex items-center gap-3 mb-3">
                  <Checkbox
                    checked={formData.integracao_ativa}
                    onCheckedChange={(checked) => {
                      const isChecked = checked === true
                      setFormData({
                        ...formData,
                        integracao_ativa: isChecked,
                        data_integracao: isChecked ? formData.data_integracao : '',
                        hora_integracao: isChecked ? formData.hora_integracao : '',
                        tipo_integracao: isChecked ? formData.tipo_integracao : '',
                      })
                    }}
                  />
                  <Label className="text-xs font-bold text-slate-700 cursor-pointer">
                    Ativar Integração
                  </Label>
                </div>
                {formData.integracao_ativa && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-700">Data da Integração</Label>
                      <Input
                        type="date"
                        value={formData.data_integracao}
                        onChange={(e) =>
                          setFormData({ ...formData, data_integracao: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-700">Hora da Integração</Label>
                      <Input
                        type="time"
                        value={formData.hora_integracao}
                        onChange={(e) =>
                          setFormData({ ...formData, hora_integracao: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-700">Tipo de Integração</Label>
                      <Select
                        value={formData.tipo_integracao}
                        onValueChange={(val) =>
                          setFormData({
                            ...formData,
                            tipo_integracao: val as 'Presencial' | 'On-line' | '',
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Presencial">Presencial</SelectItem>
                          <SelectItem value="On-line">On-line</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                {formData.integracao_ativa && (
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">
                      Informações de Integração
                    </Label>
                    <Input
                      value={formData.informacoes_integracao}
                      onChange={(e) =>
                        setFormData({ ...formData, informacoes_integracao: e.target.value })
                      }
                      placeholder="Informações adicionais sobre a integração"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Status-Driven Communication Actions */}
            {(showComplementBtn || showExamBtn || showDisqualBtn || showIntegrationBtn) && (
              <div className="pt-3 border-t border-slate-200 space-y-2">
                {showComplementBtn && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendEmail}
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
                    onClick={handleSendDisqualification}
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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendIntegration}
                    disabled={sendingIntegration || !formData.email}
                    className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {sendingIntegration ? 'Enviando...' : 'Enviar Aviso de Integração'}
                    {hasEmailBeenSent(emailLogs, 'aviso_integracao_candidato') && (
                      <Check className="h-4 w-4 ml-2 text-emerald-600" />
                    )}
                  </Button>
                )}
              </div>
            )}

            {/* Último status registrado */}
            {editingCandidate && (
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs">
                <span className="font-semibold text-slate-700 block mb-1">
                  Último status registrado
                </span>
                {loadingHistory ? (
                  <span className="text-slate-400">Carregando histórico...</span>
                ) : latestStatusHistory ? (
                  <div className="flex flex-wrap items-center gap-2 text-slate-600">
                    <Badge
                      variant="outline"
                      className={getCandidateStatusBadgeClass(
                        latestStatusHistory.status_novo as CandidateStatus,
                      )}
                    >
                      {latestStatusHistory.status_novo}
                    </Badge>
                    <span className="text-slate-400">•</span>
                    <span>
                      {formatDateBR(
                        latestStatusHistory.data_mudanca || latestStatusHistory.created,
                      )}
                    </span>
                  </div>
                ) : (
                  <span className="text-slate-500">Nenhuma alteração de status registrada</span>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
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
        candidate={editingCandidate}
        clinicas={clinicas}
        onSuccess={loadData}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Confirmação de Exclusão"
        description="Deseja realmente excluir este candidato?"
        confirmText="Confirmar"
        cancelText="Cancelar"
        variant="destructive"
        loading={deleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
