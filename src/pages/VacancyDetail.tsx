import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getVacancy, updateVacancy, deleteVacancy } from '@/services/vacancies'
import {
  getCandidates,
  createCandidate,
  updateCandidate,
  sendComplementDataRequest,
  sendDisqualificationNotice,
} from '@/services/candidates'
import { getEmailLogsForCandidate, hasEmailBeenSent } from '@/services/candidate_email_logs'
import { getPipelineHistory, createPipelineHistory } from '@/services/pipeline_history'
import { getCandidateHistory } from '@/services/candidate_history'
import {
  VacancyRecord,
  CandidateRecord,
  PipelineHistoryRecord,
  CandidateHistoryRecord,
  VacancyStatus,
  CandidateStatus,
  CandidateEmailLogRecord,
} from '@/types'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { MandatoryIndicatorCard } from '@/components/MandatoryIndicatorCard'
import {
  calculateDaysOpen,
  formatCurrency,
  formatDateBR,
  getVacancyStatusBadgeClass,
  getPriorityBadgeClass,
  getCandidateStatusBadgeClass,
  PIPELINE_PHASES,
  VACANCY_STATUS_OPTIONS,
  VACANCY_STATUS_LABELS,
  CANDIDATE_STATUS_TO_PHASE,
} from '@/lib/status-utils'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Pencil,
  PlusCircle,
  Building2,
  User,
  DollarSign,
  History,
  Users,
  Star,
  Trash2,
  UserCheck,
  Mail,
  Check,
} from 'lucide-react'
import { StarRating } from '@/components/StarRating'
import { CurrencyInput } from '@/components/CurrencyInput'
import { Textarea } from '@/components/ui/textarea'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'
import { isCandidateStatusEnabled } from '@/lib/candidate-validation'

export default function VacancyDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, isSuperAdmin, isAdmin, canEditVacancy } = useAuth()
  const canEditCandidate = isAdmin || isSuperAdmin

  const [vaga, setVaga] = useState<VacancyRecord | null>(null)
  const [candidates, setCandidates] = useState<CandidateRecord[]>([])
  const [history, setHistory] = useState<PipelineHistoryRecord[]>([])
  const [candidateHistory, setCandidateHistory] = useState<CandidateHistoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  // New Candidate Modal
  const [candidateModalOpen, setCandidateModalOpen] = useState(false)
  const [nomeCandidato, setNomeCandidato] = useState('')
  const [emailCandidato, setEmailCandidato] = useState('')
  const [telefoneCandidato, setTelefoneCandidato] = useState('')
  const [custoConsultas, setCustoConsultas] = useState(0)
  const [custoExames, setCustoExames] = useState(0)
  const [custoTestes, setCustoTestes] = useState(0)
  const [custoExtras, setCustoExtras] = useState(0)
  const [statusCandidato, setStatusCandidato] = useState<CandidateStatus>('Análise do RH')
  const [rankCandidato, setRankCandidato] = useState<number | null>(null)
  const [rankError, setRankError] = useState('')
  const [savingCandidate, setSavingCandidate] = useState(false)

  // Edit Candidate Modal
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingCandidate, setEditingCandidate] = useState<CandidateRecord | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editTelefone, setEditTelefone] = useState('')
  const [editCpf, setEditCpf] = useState('')
  const [editCidade, setEditCidade] = useState('')
  const [editBairro, setEditBairro] = useState('')
  const [editStatus, setEditStatus] = useState<CandidateStatus>('Análise do RH')
  const [editRank, setEditRank] = useState<number | null>(null)
  const [editCustoConsultas, setEditCustoConsultas] = useState(0)
  const [editCustoExames, setEditCustoExames] = useState(0)
  const [editCustoTestes, setEditCustoTestes] = useState(0)
  const [editCustoExtras, setEditCustoExtras] = useState(0)
  const [editRg, setEditRg] = useState('')
  const [editTamanhoFardamento, setEditTamanhoFardamento] = useState('')
  const [editTamanhoSapato, setEditTamanhoSapato] = useState('')
  const [editValeTransporte, setEditValeTransporte] = useState(0)
  const [editNomePai, setEditNomePai] = useState('')
  const [editNomeMae, setEditNomeMae] = useState('')
  const [editTelefoneEmergencia, setEditTelefoneEmergencia] = useState('')
  const [editObservacao, setEditObservacao] = useState('')
  const [editOrdemExecucao, setEditOrdemExecucao] = useState('')
  const [editFieldErrors, setEditFieldErrors] = useState<FieldErrors>({})
  const [savingEdit, setSavingEdit] = useState(false)

  const [rgCandidato, setRgCandidato] = useState('')
  const [tamanhoFardamentoCandidato, setTamanhoFardamentoCandidato] = useState('')
  const [tamanhoSapatoCandidato, setTamanhoSapatoCandidato] = useState('')
  const [valeTransporteCandidato, setValeTransporteCandidato] = useState(0)
  const [nomePaiCandidato, setNomePaiCandidato] = useState('')
  const [nomeMaeCandidato, setNomeMaeCandidato] = useState('')
  const [telefoneEmergenciaCandidato, setTelefoneEmergenciaCandidato] = useState('')
  const [cpfCandidato, setCpfCandidato] = useState('')
  const [cidadeCandidato, setCidadeCandidato] = useState('')
  const [bairroCandidato, setBairroCandidato] = useState('')
  const [ordemExecucaoCandidato, setOrdemExecucaoCandidato] = useState('')

  // Complement email
  const [sendingEmail, setSendingEmail] = useState(false)
  const [sendingDisqualEmail, setSendingDisqualEmail] = useState(false)
  const [emailLogs, setEmailLogs] = useState<CandidateEmailLogRecord[]>([])

  // Status change
  const [statusChanging, setStatusChanging] = useState(false)

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const loadData = async () => {
    if (!id) return
    try {
      const vData = await getVacancy(id)
      setVaga(vData)
      setLoadError(false)
      try {
        const [cData, hData, chData] = await Promise.all([
          getCandidates(id).catch(() => []),
          getPipelineHistory(id).catch(() => []),
          getCandidateHistory(id).catch(() => []),
        ])
        setCandidates(cData)
        setHistory(hData)
        setCandidateHistory(chData)
      } catch (_) {
        // Non-critical: vacancy loaded but related data failed
      }
    } catch (err) {
      setLoadError(true)
      toast.error('Erro ao carregar detalhes da vaga')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  useRealtime('vacancies', () => loadData())
  useRealtime('candidates', () => loadData())
  useRealtime('pipeline_history', () => loadData())
  useRealtime('candidate_history', () => loadData())

  // Total vacancy cost calculation
  const totalVacancyCosts = useMemo(() => {
    const candidateCosts = candidates.reduce((acc, c) => {
      return (
        acc +
        (c.custo_consultas || 0) +
        (c.custo_exames || 0) +
        (c.custo_testes || 0) +
        (c.custo_extras || 0)
      )
    }, 0)
    return candidateCosts + (vaga?.despesas_vaga || 0)
  }, [candidates, vaga])

  // Indicator logic for this single vacancy
  const preApprovedCount = useMemo(() => {
    return candidates.filter((c) => c.status_candidato === 'Cadastro DP').length
  }, [candidates])

  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nomeCandidato.trim() || !id) {
      toast.error('O nome do candidato é obrigatório.')
      return
    }

    if (
      rankCandidato != null &&
      (rankCandidato < 1 || rankCandidato > 5 || !Number.isInteger(rankCandidato))
    ) {
      setRankError('O ranking deve ser um valor entre 1 e 5 estrelas.')
      return
    }
    setRankError('')

    setSavingCandidate(true)
    try {
      await createCandidate({
        vacancy_id: id,
        nome: nomeCandidato,
        email: emailCandidato,
        telefone: telefoneCandidato,
        cpf: cpfCandidato,
        cidade: cidadeCandidato,
        bairro: bairroCandidato,
        custo_consultas: Number(custoConsultas),
        custo_exames: Number(custoExames),
        custo_testes: Number(custoTestes),
        custo_extras: Number(custoExtras),
        status_candidato: statusCandidato,
        rank: rankCandidato ?? null,
        rg: rgCandidato,
        tamanho_fardamento: tamanhoFardamentoCandidato || null,
        tamanho_sapato: tamanhoSapatoCandidato,
        vale_transporte_qtd: Number(valeTransporteCandidato),
        nome_pai: nomePaiCandidato,
        nome_mae: nomeMaeCandidato,
        telefone_emergencia: telefoneEmergenciaCandidato,
        ordem_execucao: ordemExecucaoCandidato.trim() || undefined,
      })

      toast.success('Candidato adicionado com sucesso!')
      setCandidateModalOpen(false)
      setNomeCandidato('')
      setEmailCandidato('')
      setTelefoneCandidato('')
      setCustoConsultas(0)
      setCustoExames(0)
      setCustoTestes(0)
      setCustoExtras(0)
      setRankCandidato(null)
      setStatusCandidato('Análise do RH')
      setRgCandidato('')
      setTamanhoFardamentoCandidato('')
      setTamanhoSapatoCandidato('')
      setCpfCandidato('')
      setCidadeCandidato('')
      setBairroCandidato('')
      setValeTransporteCandidato(0)
      setNomePaiCandidato('')
      setNomeMaeCandidato('')
      setTelefoneEmergenciaCandidato('')
      setOrdemExecucaoCandidato('')
      loadData()
    } catch (err) {
      toast.error('Erro ao salvar candidato')
    } finally {
      setSavingCandidate(false)
    }
  }

  const handleEditCandidate = (candidate: CandidateRecord) => {
    setEditingCandidate(candidate)
    setEditNome(candidate.nome || '')
    setEditEmail(candidate.email || '')
    setEditTelefone(candidate.telefone || '')
    setEditCpf(candidate.cpf || '')
    setEditCidade(candidate.cidade || '')
    setEditBairro(candidate.bairro || '')
    setEditStatus(candidate.status_candidato || 'Análise do RH')
    setEditRank(candidate.rank ?? null)
    setEditCustoConsultas(candidate.custo_consultas || 0)
    setEditCustoExames(candidate.custo_exames || 0)
    setEditCustoTestes(candidate.custo_testes || 0)
    setEditCustoExtras(candidate.custo_extras || 0)
    setEditRg(candidate.rg || '')
    setEditTamanhoFardamento(candidate.tamanho_fardamento || '')
    setEditTamanhoSapato(candidate.tamanho_sapato || '')
    setEditValeTransporte(candidate.vale_transporte_qtd || 0)
    setEditNomePai(candidate.nome_pai || '')
    setEditNomeMae(candidate.nome_mae || '')
    setEditTelefoneEmergencia(candidate.telefone_emergencia || '')
    setEditObservacao(candidate.observacao || '')
    setEditOrdemExecucao(candidate.ordem_execucao || '')
    setEditFieldErrors({})
    setEmailLogs([])
    getEmailLogsForCandidate(candidate.id)
      .then(setEmailLogs)
      .catch(() => {})
    setEditModalOpen(true)
  }

  const handleUpdateCandidate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCandidate) return
    if (!editNome.trim()) {
      setEditFieldErrors({ nome: 'Nome é obrigatório' })
      return
    }
    setEditFieldErrors({})
    setSavingEdit(true)
    try {
      await updateCandidate(editingCandidate.id, {
        nome: editNome.trim(),
        email: editEmail.trim() || undefined,
        telefone: editTelefone.trim() || undefined,
        cpf: editCpf.trim() || undefined,
        cidade: editCidade.trim() || undefined,
        bairro: editBairro.trim() || undefined,
        status_candidato: editStatus,
        rank: editRank ?? null,
        custo_consultas: editCustoConsultas,
        custo_exames: editCustoExames,
        custo_testes: editCustoTestes,
        custo_extras: editCustoExtras,
        rg: editRg.trim() || undefined,
        tamanho_fardamento: editTamanhoFardamento || undefined,
        tamanho_sapato: editTamanhoSapato.trim() || undefined,
        vale_transporte_qtd: editValeTransporte || undefined,
        nome_pai: editNomePai.trim() || undefined,
        nome_mae: editNomeMae.trim() || undefined,
        telefone_emergencia: editTelefoneEmergencia.trim() || undefined,
        observacao: editObservacao.trim() || undefined,
        ordem_execucao: editOrdemExecucao.trim() || undefined,
      })
      toast.success('Candidato atualizado com sucesso!')
      setEditModalOpen(false)
      setEditingCandidate(null)
      loadData()
    } catch (err) {
      setEditFieldErrors(extractFieldErrors(err))
      toast.error('Erro ao atualizar candidato')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleStatusChange = async (newStatus: VacancyStatus) => {
    if (!vaga || newStatus === vaga.status_vaga) return
    if (newStatus === 'Concluída') {
      const integradoCount = candidates.filter((c) => c.status_candidato === 'Integrado').length
      if (integradoCount < (vaga.quantidade_vagas || 0)) {
        toast.error(
          'A vaga não pode ser concluída até que todas as posições sejam preenchidas. Verifique se o número de candidatos integrados é igual ou superior à quantidade de vagas.',
        )
        return
      }
    }
    setStatusChanging(true)
    try {
      await updateVacancy(vaga.id, {
        status_vaga: newStatus,
        data_fechamento:
          newStatus === 'Concluída' ? new Date().toISOString() : vaga.data_fechamento,
        data_cancelamento:
          newStatus === 'Cancelada' ? new Date().toISOString() : vaga.data_cancelamento,
      })

      await createPipelineHistory({
        vacancy_id: vaga.id,
        usuario_id: user?.id,
        status_anterior: vaga.status_vaga,
        status_novo: newStatus,
      })

      toast.success(`Status alterado para "${newStatus}"`)
      loadData()
    } catch (err) {
      toast.error('Erro ao atualizar status')
    } finally {
      setStatusChanging(false)
    }
  }

  const handleDeleteVacancy = async () => {
    if (!vaga) return
    setDeleting(true)
    try {
      await deleteVacancy(vaga.id)
      toast.success('Vaga excluída com sucesso!')
      navigate('/vagas')
    } catch (err) {
      toast.error('Erro ao excluir vaga')
    } finally {
      setDeleting(false)
    }
  }

  const COMPLEMENT_STATUSES: CandidateStatus[] = [
    'Análise do RH',
    'Análise do gestor',
    'Documentação e exame',
  ]

  const DISQUALIFICATION_STATUSES: CandidateStatus[] = ['Desclassificado', 'Em banco']

  const handleSendEmail = async () => {
    if (!editingCandidate) return
    setSendingEmail(true)
    try {
      await sendComplementDataRequest(editingCandidate.id)
      toast.success('E-mail enviado com sucesso!')
      const logs = await getEmailLogsForCandidate(editingCandidate.id)
      setEmailLogs(logs)
    } catch (err) {
      toast.error('Erro ao enviar e-mail')
    } finally {
      setSendingEmail(false)
    }
  }

  const handleSendDisqualification = async () => {
    if (!editingCandidate) return
    setSendingDisqualEmail(true)
    try {
      await sendDisqualificationNotice(editingCandidate.id)
      toast.success('E-mail enviado com sucesso!')
      const logs = await getEmailLogsForCandidate(editingCandidate.id)
      setEmailLogs(logs)
    } catch (err) {
      toast.error('Erro ao enviar e-mail')
    } finally {
      setSendingDisqualEmail(false)
    }
  }

  const averageRank = useMemo(() => {
    const ranked = candidates.filter((c) => c.rank != null)
    if (ranked.length === 0) return 0
    const total = ranked.reduce((acc, c) => acc + (c.rank || 0), 0)
    return Math.round((total / ranked.length) * 10) / 10
  }, [candidates])

  const phaseCounts = useMemo(() => {
    const counts: Record<string, number> = {
      Triagem: 0,
      Entrevistas: 0,
      'Pré-Aprovação': 0,
      Contratação: 0,
      Fechada: 0,
    }
    candidates.forEach((c) => {
      const phase = CANDIDATE_STATUS_TO_PHASE[c.status_candidato]
      if (phase && phase in counts) {
        counts[phase]++
      }
    })
    return counts
  }, [candidates])

  const hasActiveCandidates = useMemo(
    () => Object.values(phaseCounts).some((count) => count > 0),
    [phaseCounts],
  )

  const isAddStatusEnabled = isCandidateStatusEnabled({
    nome: nomeCandidato,
    email: emailCandidato,
    telefone: telefoneCandidato,
    cpf: cpfCandidato,
    cidade: cidadeCandidato,
    bairro: bairroCandidato,
    vacancy_id: id,
    ordem_execucao: ordemExecucaoCandidato,
  })

  const isEditStatusEnabled = isCandidateStatusEnabled({
    nome: editNome,
    email: editEmail,
    telefone: editTelefone,
    cpf: editCpf,
    cidade: editCidade,
    bairro: editBairro,
    vacancy_id: editingCandidate?.vacancy_id,
    ordem_execucao: editOrdemExecucao,
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    )
  }

  if (loadError || !vaga) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3 text-center">
        <p className="text-sm text-slate-600">
          Não foi possível carregar os detalhes da vaga. Tente novamente.
        </p>
        <Button variant="outline" onClick={() => navigate('/vagas')}>
          Voltar para Vagas
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back button & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Button
          variant="ghost"
          onClick={() => navigate('/vagas')}
          className="text-slate-600 self-start"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para Vagas
        </Button>

        <div className="flex items-center space-x-2">
          {canEditVacancy && (
            <>
              <Select
                value={vaga.status_vaga}
                onValueChange={(v) => handleStatusChange(v as VacancyStatus)}
                disabled={statusChanging || !vaga.ordem_execucao?.trim()}
              >
                <SelectTrigger className="w-[160px] h-9 text-xs border-indigo-200 text-indigo-700">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {VACANCY_STATUS_OPTIONS.map((st) => (
                    <SelectItem
                      key={st}
                      value={st}
                      disabled={
                        st === 'Concluída' &&
                        candidates.filter((c) => c.status_candidato === 'Integrado').length <
                          (vaga.quantidade_vagas || 0)
                      }
                    >
                      {VACANCY_STATUS_LABELS[st]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button asChild className="bg-indigo-600 hover:bg-indigo-500 text-white">
                <Link to={`/vagas/${vaga.id}/editar`}>
                  <Pencil className="h-4 w-4 mr-2" /> Editar Vaga
                </Link>
              </Button>
            </>
          )}
          {isSuperAdmin && (
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(true)}
              className="border-rose-200 text-rose-700 hover:bg-rose-50"
            >
              <Trash2 className="h-4 w-4 mr-2" /> Excluir Vaga
            </Button>
          )}
        </div>
      </div>

      {/* Main Vacancy Card */}
      <Card className="border-slate-200 shadow-2xs">
        <CardContent className="p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold text-slate-900">
                  {vaga.expand?.cargo?.nome || '—'}
                </h1>
                <Badge variant="outline" className={getVacancyStatusBadgeClass(vaga.status_vaga)}>
                  {vaga.status_vaga}
                </Badge>
                <Badge variant="outline" className={getPriorityBadgeClass(vaga.prioridade)}>
                  Prioridade {vaga.prioridade}
                </Badge>
              </div>
              <div className="flex items-center space-x-4 text-xs text-slate-500 mt-1">
                <span className="flex items-center space-x-1">
                  <Building2 className="h-3.5 w-3.5" />
                  <strong className="text-slate-700">{vaga.expand?.cliente?.nome || '—'}</strong>
                </span>
                {vaga.expand?.cidade?.nome && <span>• {vaga.expand?.cidade?.nome}</span>}
                <span>
                  • {vaga.quantidade_vagas} vaga(s) ({vaga.expand?.tipo_vaga?.nome || 'Efetivo'})
                </span>
              </div>
            </div>

            <div className="text-left md:text-right bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Tempo Aberto
              </span>
              <span className="text-xl font-black text-indigo-700">
                {calculateDaysOpen(vaga.data_abertura, vaga.data_fechamento)} dias
              </span>
            </div>
          </div>

          {/* Pipeline Step Indicator */}
          <div>
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-3">
              Fluxo do Pipeline
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {PIPELINE_PHASES.map((phase) => {
                const count = phaseCounts[phase] ?? 0
                const isActive =
                  phase === 'Aberta'
                    ? !hasActiveCandidates
                    : phase === 'Cancelada'
                      ? vaga.status_vaga === 'Cancelada'
                      : count > 0

                return (
                  <div
                    key={phase}
                    className={`p-2.5 rounded-lg border text-center transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs'
                        : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}
                  >
                    <span className="text-xs truncate block">{phase}</span>
                    {phase !== 'Aberta' && phase !== 'Cancelada' && (
                      <span
                        className={`text-[10px] block mt-0.5 ${
                          isActive ? 'text-indigo-100' : 'text-slate-400'
                        }`}
                      >
                        {count} cand.
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Information Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Informações da Vaga
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-lg">
                  <span className="text-slate-400 block">Faixa Salarial</span>
                  <span className="font-semibold text-slate-800">
                    {vaga.salario_faixa || 'A combinar'}
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg">
                  <span className="text-slate-400 block">Responsável RH</span>
                  <span className="font-semibold text-slate-800">
                    {vaga.expand?.responsavel_rh?.name || '-'}
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg">
                  <span className="text-slate-400 block">Gestor Operacional</span>
                  <span className="font-semibold text-slate-800">
                    {vaga.responsavel_operacional || '-'}
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg">
                  <span className="text-slate-400 block">Prazo Desejado</span>
                  <span className="font-semibold text-slate-800">
                    {formatDateBR(vaga.prazo_desejado)}
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg">
                  <span className="text-slate-400 block">Tipo de Contrato</span>
                  <span className="font-semibold text-slate-800">
                    {vaga.expand?.tipo_contrato?.nome || '-'}
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg">
                  <span className="text-slate-400 block">Tipo da Vaga</span>
                  <span className="font-semibold text-slate-800">
                    {vaga.expand?.tipo_vaga?.nome || '-'}
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg">
                  <span className="text-slate-400 block">Ordem de Execução</span>
                  <span className="font-semibold text-slate-800">{vaga.ordem_execucao || '-'}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Especificações e Observações
              </h3>
              <div className="space-y-2 text-xs">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="font-semibold text-slate-700 block mb-0.5">Requisitos</span>
                  <p className="text-slate-600 whitespace-pre-line">
                    {vaga.especificacoes || 'Sem especificações'}
                  </p>
                </div>
                {vaga.observacoes_internas && (
                  <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-100">
                    <span className="font-semibold text-amber-800 block mb-0.5">Obs. Internas</span>
                    <p className="text-amber-700 whitespace-pre-line">
                      {vaga.observacoes_internas}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mandatory Indicator Card for this vacancy */}
      <MandatoryIndicatorCard
        candidatosEmProcesso={
          candidates.filter(
            (c) => !['Desistente', 'Desclassificado', 'Em banco'].includes(c.status_candidato),
          ).length
        }
        totalPosicoes={vaga.status_vaga === 'Aberta' ? vaga.quantidade_vagas || 0 : 0}
        candidatosIntegrados={candidates.filter((c) => c.status_candidato === 'Integrado').length}
        compact
      />

      {/* Costs & Linked Candidates Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cost Summary Card */}
        <Card className="border-slate-200 shadow-2xs lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-emerald-600" />
              <span>Custos Totais da Vaga</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Soma de exames, consultas e testes dos candidatos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-center">
              <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider block">
                Investimento Total
              </span>
              <span className="text-3xl font-black text-emerald-700 mt-1 block">
                {formatCurrency(totalVacancyCosts)}
              </span>
            </div>

            <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl text-center">
              <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider flex items-center justify-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                Ranking Médio
              </span>
              <span className="text-2xl font-black text-amber-700 mt-1 block">
                {averageRank > 0 ? `${averageRank} / 5` : '—'}
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>Consultas:</span>
                <span className="font-semibold">
                  {formatCurrency(candidates.reduce((a, b) => a + (b.custo_consultas || 0), 0))}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>Exames Admissionais:</span>
                <span className="font-semibold">
                  {formatCurrency(candidates.reduce((a, b) => a + (b.custo_exames || 0), 0))}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>Testes / Avaliações:</span>
                <span className="font-semibold">
                  {formatCurrency(candidates.reduce((a, b) => a + (b.custo_testes || 0), 0))}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span>Extras / Deslocamento:</span>
                <span className="font-semibold">
                  {formatCurrency(candidates.reduce((a, b) => a + (b.custo_extras || 0), 0))}
                </span>
              </div>
              <div className="flex justify-between py-1 border-t border-slate-200 mt-1 pt-2">
                <span className="font-bold text-slate-700">Despesas da Vaga:</span>
                <span className="font-semibold text-slate-900">
                  {formatCurrency(vaga.despesas_vaga || 0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Linked Candidates List */}
        <Card className="border-slate-200 shadow-2xs lg:col-span-2">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Users className="h-5 w-5 text-indigo-600" />
                <span>Candidatos Vinculados ({candidates.length})</span>
              </CardTitle>
            </div>
            <Button
              size="sm"
              onClick={() => setCandidateModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              <PlusCircle className="h-4 w-4 mr-1.5" /> Adicionar Candidato
            </Button>
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-xs font-semibold text-slate-600">Nome</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Ranking</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Contato</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 text-right">
                    Custo Total
                  </TableHead>
                  {canEditCandidate && (
                    <TableHead className="text-xs font-semibold text-slate-600 text-center">
                      Ações
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={canEditCandidate ? 6 : 5}
                      className="text-center py-6 text-slate-500 text-sm"
                    >
                      Nenhum candidato vinculado a esta vaga ainda.{' '}
                    </TableCell>
                  </TableRow>
                ) : (
                  candidates.map((cand) => {
                    const candidateTotal =
                      (cand.custo_consultas || 0) +
                      (cand.custo_exames || 0) +
                      (cand.custo_testes || 0) +
                      (cand.custo_extras || 0)

                    return (
                      <TableRow key={cand.id}>
                        <TableCell className="font-semibold text-slate-900 text-sm">
                          <Link
                            to={`/candidatos/${cand.id}`}
                            state={{ fromVacancy: vaga.id }}
                            className="hover:text-indigo-600 hover:underline"
                          >
                            {cand.nome}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {cand.rank ? (
                            <StarRating value={cand.rank} readOnly size={14} />
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          <div>{cand.email || '-'}</div>
                          <div className="text-slate-400">{cand.telefone}</div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={getCandidateStatusBadgeClass(cand.status_candidato)}
                          >
                            {cand.status_candidato}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium text-slate-900 text-sm">
                          {formatCurrency(candidateTotal)}
                        </TableCell>
                        {canEditCandidate && (
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditCandidate(cand)}
                              className="h-8 w-8 text-slate-500 hover:text-indigo-600"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Vacancy History Log */}
      <Card className="border-slate-200 shadow-2xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <History className="h-5 w-5 text-purple-600" />
            <span>Histórico da Vaga</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Registro auditável de todas as mudanças de status desta vaga
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-xs font-semibold text-slate-600">Data / Hora</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Usuário</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">
                  De (Status Anterior)
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">
                  Para (Novo Status)
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 text-slate-500 text-sm">
                    Nenhuma mudança gravada no histórico ainda.
                  </TableCell>
                </TableRow>
              ) : (
                history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-xs text-slate-600">
                      {formatDateBR(h.created)}
                    </TableCell>
                    <TableCell className="text-xs font-medium text-slate-800">
                      {h.expand?.usuario_id?.name || 'Sistema'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="bg-slate-100 text-slate-600 border-slate-200"
                      >
                        {h.status_anterior || 'Início'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="bg-indigo-50 text-indigo-700 border-indigo-200"
                      >
                        {h.status_novo}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Candidate History Log */}
      <Card className="border-slate-200 shadow-2xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <UserCheck className="h-5 w-5 text-cyan-600" />
            <span>Histórico de Candidatos</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Registro auditável de todas as mudanças de status dos candidatos vinculados
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-xs font-semibold text-slate-600">Candidato</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Usuário</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">
                  De (Status Anterior)
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">
                  Para (Novo Status)
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Data / Hora</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidateHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-slate-500 text-sm">
                    Nenhuma mudança de status de candidato registrada ainda.
                  </TableCell>
                </TableRow>
              ) : (
                candidateHistory.map((ch) => (
                  <TableRow key={ch.id}>
                    <TableCell className="font-semibold text-slate-900 text-sm">
                      {ch.expand?.candidate_id?.nome || '—'}
                    </TableCell>
                    <TableCell className="text-xs font-medium text-slate-800">
                      {ch.expand?.usuario_id?.name || 'Sistema'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="bg-slate-100 text-slate-600 border-slate-200"
                      >
                        {ch.status_anterior || 'Início'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-cyan-50 text-cyan-700 border-cyan-200">
                        {ch.status_novo}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {formatDateBR(ch.data_mudanca || ch.created)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Candidate Modal */}
      <Dialog open={candidateModalOpen} onOpenChange={setCandidateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Candidato à Vaga</DialogTitle>
            <DialogDescription>
              Vincular novo candidato para{' '}
              <strong className="text-slate-900">{vaga.expand?.cargo?.nome || '—'}</strong>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddCandidate} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cNome" className="text-xs font-bold text-slate-700">
                Nome Completo <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="cNome"
                placeholder="Ex: Juliana Rocha"
                value={nomeCandidato}
                onChange={(e) => setNomeCandidato(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cEmail" className="text-xs font-semibold text-slate-700">
                  Email
                </Label>
                <Input
                  id="cEmail"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={emailCandidato}
                  onChange={(e) => setEmailCandidato(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cTelefone" className="text-xs font-semibold text-slate-700">
                  Telefone
                </Label>
                <Input
                  id="cTelefone"
                  placeholder="(00) 00000-0000"
                  value={telefoneCandidato}
                  onChange={(e) => setTelefoneCandidato(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cCpf" className="text-xs font-semibold text-slate-700">
                  CPF
                </Label>
                <Input
                  id="cCpf"
                  placeholder="000.000.000-00"
                  value={cpfCandidato}
                  onChange={(e) => setCpfCandidato(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cCidade" className="text-xs font-semibold text-slate-700">
                  Cidade
                </Label>
                <Input
                  id="cCidade"
                  value={cidadeCandidato}
                  onChange={(e) => setCidadeCandidato(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cBairro" className="text-xs font-semibold text-slate-700">
                  Bairro
                </Label>
                <Input
                  id="cBairro"
                  value={bairroCandidato}
                  onChange={(e) => setBairroCandidato(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cOrdemExec" className="text-xs font-bold text-slate-700">
                O.E — Ordem de Execução
              </Label>
              <Input
                id="cOrdemExec"
                placeholder="Informe a ordem de execução"
                value={ordemExecucaoCandidato}
                onChange={(e) => setOrdemExecucaoCandidato(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Status Inicial</Label>
              <Select
                value={statusCandidato}
                onValueChange={(v) => setStatusCandidato(v as CandidateStatus)}
                disabled={!isAddStatusEnabled}
              >
                <SelectTrigger disabled={!isAddStatusEnabled}>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Análise do RH">Análise do RH</SelectItem>
                  <SelectItem value="Análise do gestor">Análise do gestor</SelectItem>
                  <SelectItem value="Documentação e exame">Documentação e exame</SelectItem>
                  <SelectItem value="Cadastro DP">Cadastro DP</SelectItem>
                  <SelectItem value="Integrado">Integrado</SelectItem>
                  <SelectItem value="Desistente">Desistente</SelectItem>
                  <SelectItem value="Desclassificado">Desclassificado</SelectItem>
                  <SelectItem value="Em banco">Em banco</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Ranking (1-5 estrelas)</Label>
              <StarRating value={rankCandidato} onChange={setRankCandidato} size={28} />
              {rankError && <p className="text-xs text-rose-500 mt-1">{rankError}</p>}
            </div>

            <div className="pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-700 block mb-2">
                Custos com o Candidato (R$)
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <Label htmlFor="cCons" className="text-[10px] text-slate-500">
                    Consultas
                  </Label>
                  <Input
                    id="cCons"
                    type="number"
                    min={0}
                    value={custoConsultas}
                    onChange={(e) => setCustoConsultas(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="cExam" className="text-[10px] text-slate-500">
                    Exames
                  </Label>
                  <Input
                    id="cExam"
                    type="number"
                    min={0}
                    value={custoExames}
                    onChange={(e) => setCustoExames(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="cTest" className="text-[10px] text-slate-500">
                    Testes
                  </Label>
                  <Input
                    id="cTest"
                    type="number"
                    min={0}
                    value={custoTestes}
                    onChange={(e) => setCustoTestes(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="cExtr" className="text-[10px] text-slate-500">
                    Extras
                  </Label>
                  <Input
                    id="cExtr"
                    type="number"
                    min={0}
                    value={custoExtras}
                    onChange={(e) => setCustoExtras(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-700 block mb-2">
                Dados Complementares
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <Label htmlFor="vdRg" className="text-[10px] text-slate-500">
                    RG
                  </Label>
                  <Input
                    id="vdRg"
                    value={rgCandidato}
                    onChange={(e) => setRgCandidato(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-slate-500">Tamanho Fardamento</Label>
                  <Select
                    value={tamanhoFardamentoCandidato}
                    onValueChange={setTamanhoFardamentoCandidato}
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
                <div>
                  <Label htmlFor="vdSapato" className="text-[10px] text-slate-500">
                    Tamanho Sapato
                  </Label>
                  <Input
                    id="vdSapato"
                    value={tamanhoSapatoCandidato}
                    onChange={(e) => setTamanhoSapatoCandidato(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="vdVt" className="text-[10px] text-slate-500">
                    Vale-transporte (qtd/dia)
                  </Label>
                  <Input
                    id="vdVt"
                    type="number"
                    min={0}
                    value={valeTransporteCandidato}
                    onChange={(e) => setValeTransporteCandidato(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="vdPai" className="text-[10px] text-slate-500">
                    Nome do Pai
                  </Label>
                  <Input
                    id="vdPai"
                    value={nomePaiCandidato}
                    onChange={(e) => setNomePaiCandidato(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="vdMae" className="text-[10px] text-slate-500">
                    Nome da Mãe
                  </Label>
                  <Input
                    id="vdMae"
                    value={nomeMaeCandidato}
                    onChange={(e) => setNomeMaeCandidato(e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="vdEmergencia" className="text-[10px] text-slate-500">
                    Telefone para Emergência
                  </Label>
                  <Input
                    id="vdEmergencia"
                    value={telefoneEmergenciaCandidato}
                    onChange={(e) => setTelefoneEmergenciaCandidato(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setCandidateModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingCandidate}
                className="bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                {savingCandidate ? 'Salvando...' : 'Adicionar Candidato'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Candidate Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Candidato</DialogTitle>
            <DialogDescription>
              Atualizar informações de{' '}
              <strong className="text-slate-900">{editingCandidate?.nome || ''}</strong>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateCandidate} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="eNome" className="text-xs font-bold text-slate-700">
                Nome Completo <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="eNome"
                placeholder="Ex: Juliana Rocha"
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
                required
              />
              {editFieldErrors.nome && (
                <p className="text-xs text-rose-500 mt-0.5">{editFieldErrors.nome}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="eEmail" className="text-xs font-semibold text-slate-700">
                  Email
                </Label>
                <Input
                  id="eEmail"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
                {editFieldErrors.email && (
                  <p className="text-xs text-rose-500 mt-0.5">{editFieldErrors.email}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eTelefone" className="text-xs font-semibold text-slate-700">
                  Telefone
                </Label>
                <Input
                  id="eTelefone"
                  placeholder="(00) 00000-0000"
                  value={editTelefone}
                  onChange={(e) => setEditTelefone(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="eCpf" className="text-xs font-semibold text-slate-700">
                  CPF
                </Label>
                <Input
                  id="eCpf"
                  placeholder="000.000.000-00"
                  value={editCpf}
                  onChange={(e) => setEditCpf(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eCidade" className="text-xs font-semibold text-slate-700">
                  Cidade
                </Label>
                <Input
                  id="eCidade"
                  value={editCidade}
                  onChange={(e) => setEditCidade(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="eBairro" className="text-xs font-semibold text-slate-700">
                  Bairro
                </Label>
                <Input
                  id="eBairro"
                  value={editBairro}
                  onChange={(e) => setEditBairro(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="eOrdemExec" className="text-xs font-bold text-slate-700">
                O.E — Ordem de Execução
              </Label>
              <Input
                id="eOrdemExec"
                placeholder="Informe a ordem de execução"
                value={editOrdemExecucao}
                onChange={(e) => setEditOrdemExecucao(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Status do Candidato</Label>
              <Select
                value={editStatus}
                onValueChange={(v) => setEditStatus(v as CandidateStatus)}
                disabled={!isEditStatusEnabled}
              >
                <SelectTrigger disabled={!isEditStatusEnabled}>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Análise do RH">Análise do RH</SelectItem>
                  <SelectItem value="Análise do gestor">Análise do gestor</SelectItem>
                  <SelectItem value="Documentação e exame">Documentação e exame</SelectItem>
                  <SelectItem value="Cadastro DP">Cadastro DP</SelectItem>
                  <SelectItem value="Integrado">Integrado</SelectItem>
                  <SelectItem value="Desistente">Desistente</SelectItem>
                  <SelectItem value="Desclassificado">Desclassificado</SelectItem>
                  <SelectItem value="Em banco">Em banco</SelectItem>
                </SelectContent>
              </Select>
              {editFieldErrors.status_candidato && (
                <p className="text-xs text-rose-500 mt-0.5">{editFieldErrors.status_candidato}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Ranking (1-5 estrelas)</Label>
              <StarRating value={editRank} onChange={setEditRank} size={28} />
            </div>

            {canEditCandidate && (
              <div className="space-y-1.5">
                <Label htmlFor="eObs" className="text-xs font-bold text-slate-700">
                  Observações
                </Label>
                <Textarea
                  id="eObs"
                  value={editObservacao}
                  onChange={(e) => setEditObservacao(e.target.value)}
                  placeholder="Adicione observações sobre o candidato..."
                  rows={3}
                />
              </div>
            )}

            <div className="pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-700 block mb-2">
                Custos com o Candidato (R$)
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <Label htmlFor="eCons" className="text-[10px] text-slate-500">
                    Consultas
                  </Label>
                  <CurrencyInput
                    id="eCons"
                    value={editCustoConsultas}
                    onChange={setEditCustoConsultas}
                  />
                </div>
                <div>
                  <Label htmlFor="eExam" className="text-[10px] text-slate-500">
                    Exames
                  </Label>
                  <CurrencyInput id="eExam" value={editCustoExames} onChange={setEditCustoExames} />
                </div>
                <div>
                  <Label htmlFor="eTest" className="text-[10px] text-slate-500">
                    Testes
                  </Label>
                  <CurrencyInput id="eTest" value={editCustoTestes} onChange={setEditCustoTestes} />
                </div>
                <div>
                  <Label htmlFor="eExtr" className="text-[10px] text-slate-500">
                    Extras
                  </Label>
                  <CurrencyInput id="eExtr" value={editCustoExtras} onChange={setEditCustoExtras} />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-700 block mb-2">
                Dados Complementares
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <Label htmlFor="eRg" className="text-[10px] text-slate-500">
                    RG
                  </Label>
                  <Input id="eRg" value={editRg} onChange={(e) => setEditRg(e.target.value)} />
                </div>
                <div>
                  <Label className="text-[10px] text-slate-500">Tamanho Fardamento</Label>
                  <Select value={editTamanhoFardamento} onValueChange={setEditTamanhoFardamento}>
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
                <div>
                  <Label htmlFor="eSapato" className="text-[10px] text-slate-500">
                    Tamanho Sapato
                  </Label>
                  <Input
                    id="eSapato"
                    value={editTamanhoSapato}
                    onChange={(e) => setEditTamanhoSapato(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="eVt" className="text-[10px] text-slate-500">
                    Vale-transporte (qtd/dia)
                  </Label>
                  <Input
                    id="eVt"
                    type="number"
                    min={0}
                    value={editValeTransporte}
                    onChange={(e) => setEditValeTransporte(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="ePai" className="text-[10px] text-slate-500">
                    Nome do Pai
                  </Label>
                  <Input
                    id="ePai"
                    value={editNomePai}
                    onChange={(e) => setEditNomePai(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="eMae" className="text-[10px] text-slate-500">
                    Nome da Mãe
                  </Label>
                  <Input
                    id="eMae"
                    value={editNomeMae}
                    onChange={(e) => setEditNomeMae(e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="eEmergencia" className="text-[10px] text-slate-500">
                    Telefone para Emergência
                  </Label>
                  <Input
                    id="eEmergencia"
                    value={editTelefoneEmergencia}
                    onChange={(e) => setEditTelefoneEmergencia(e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
            </div>

            {canEditCandidate && editingCandidate && (
              <div className="pt-2 border-t border-slate-100 space-y-2">
                {COMPLEMENT_STATUSES.includes(editStatus) && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendEmail}
                    disabled={sendingEmail || !editingCandidate.email}
                    className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                    title={!editingCandidate.email ? 'Candidato não possui e-mail cadastrado' : ''}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {sendingEmail ? 'Enviando...' : 'Solicitar dados complementares'}
                    {hasEmailBeenSent(emailLogs, 'complement_data') && (
                      <Check className="h-4 w-4 ml-2 text-emerald-600" />
                    )}
                  </Button>
                )}
                {DISQUALIFICATION_STATUSES.includes(editStatus) && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendDisqualification}
                    disabled={sendingDisqualEmail || !editingCandidate.email}
                    className="w-full border-amber-200 text-amber-700 hover:bg-amber-50"
                    title={!editingCandidate.email ? 'Candidato não possui e-mail cadastrado' : ''}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {sendingDisqualEmail ? 'Enviando...' : 'Aviso de Desclassificação/Banco'}
                    {hasEmailBeenSent(emailLogs, 'disqualification') && (
                      <Check className="h-4 w-4 ml-2 text-emerald-600" />
                    )}
                  </Button>
                )}
              </div>
            )}

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingEdit}
                className="bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                {savingEdit ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Vaga</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta vaga? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteVacancy}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-500 text-white"
            >
              {deleting ? 'Excluindo...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
