import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getVacancy, updateVacancy } from '@/services/vacancies'
import { getCandidates, createCandidate } from '@/services/candidates'
import { getPipelineHistory, createPipelineHistory } from '@/services/pipeline_history'
import {
  VacancyRecord,
  CandidateRecord,
  PipelineHistoryRecord,
  VacancyStatus,
  CandidateStatus,
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
  VACANCY_PIPELINE_STAGES,
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
  Calendar,
  CheckCircle2,
  Clock,
  User,
  DollarSign,
  History,
  Users,
  Star,
} from 'lucide-react'
import { StarRating } from '@/components/StarRating'

export default function VacancyDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [vaga, setVaga] = useState<VacancyRecord | null>(null)
  const [candidates, setCandidates] = useState<CandidateRecord[]>([])
  const [history, setHistory] = useState<PipelineHistoryRecord[]>([])
  const [loading, setLoading] = useState(true)

  // New Candidate Modal
  const [candidateModalOpen, setCandidateModalOpen] = useState(false)
  const [nomeCandidato, setNomeCandidato] = useState('')
  const [emailCandidato, setEmailCandidato] = useState('')
  const [telefoneCandidato, setTelefoneCandidato] = useState('')
  const [custoConsultas, setCustoConsultas] = useState(0)
  const [custoExames, setCustoExames] = useState(0)
  const [custoTestes, setCustoTestes] = useState(0)
  const [custoExtras, setCustoExtras] = useState(0)
  const [statusCandidato, setStatusCandidato] = useState<CandidateStatus>('Em análise do gestor')
  const [rankCandidato, setRankCandidato] = useState<number | null>(null)
  const [rankError, setRankError] = useState('')
  const [savingCandidate, setSavingCandidate] = useState(false)

  // Move Pipeline Modal
  const [pipelineModalOpen, setPipelineModalOpen] = useState(false)
  const [nextStatus, setNextStatus] = useState<VacancyStatus | ''>('')

  const loadData = async () => {
    if (!id) return
    try {
      const [vData, cData, hData] = await Promise.all([
        getVacancy(id),
        getCandidates(id),
        getPipelineHistory(id),
      ])
      setVaga(vData)
      setCandidates(cData)
      setHistory(hData)
    } catch (err) {
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

  // Total vacancy cost calculation
  const totalVacancyCosts = useMemo(() => {
    return candidates.reduce((acc, c) => {
      return (
        acc +
        (c.custo_consultas || 0) +
        (c.custo_exames || 0) +
        (c.custo_testes || 0) +
        (c.custo_extras || 0)
      )
    }, 0)
  }, [candidates])

  // Indicator logic for this single vacancy
  const preApprovedCount = useMemo(() => {
    return candidates.filter((c) => c.status_candidato === 'Pré-Aprovado').length
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
        custo_consultas: Number(custoConsultas),
        custo_exames: Number(custoExames),
        custo_testes: Number(custoTestes),
        custo_extras: Number(custoExtras),
        status_candidato: statusCandidato,
        rank: rankCandidato ?? null,
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
      setStatusCandidato('Em análise do gestor')
      loadData()
    } catch (err) {
      toast.error('Erro ao salvar candidato')
    } finally {
      setSavingCandidate(false)
    }
  }

  const handleMovePipeline = async () => {
    if (!vaga || !nextStatus) return
    try {
      await updateVacancy(vaga.id, {
        status_vaga: nextStatus,
        data_fechamento: nextStatus === 'Fechada' ? new Date().toISOString() : vaga.data_fechamento,
        data_cancelamento:
          nextStatus === 'Cancelada' ? new Date().toISOString() : vaga.data_cancelamento,
      })

      await createPipelineHistory({
        vacancy_id: vaga.id,
        usuario_id: user?.id,
        status_anterior: vaga.status_vaga,
        status_novo: nextStatus,
      })

      toast.success(`Etapa alterada para "${nextStatus}"`)
      setPipelineModalOpen(false)
      loadData()
    } catch (err) {
      toast.error('Erro ao atualizar etapa')
    }
  }

  if (loading || !vaga) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    )
  }

  const currentStageIndex = VACANCY_PIPELINE_STAGES.indexOf(vaga.status_vaga)

  const averageRank = useMemo(() => {
    const ranked = candidates.filter((c) => c.rank != null)
    if (ranked.length === 0) return 0
    const total = ranked.reduce((acc, c) => acc + (c.rank || 0), 0)
    return Math.round((total / ranked.length) * 10) / 10
  }, [candidates])

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
          <Button
            variant="outline"
            onClick={() => {
              setNextStatus(vaga.status_vaga)
              setPipelineModalOpen(true)
            }}
            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
          >
            Mover Pipeline
          </Button>
          <Button asChild className="bg-indigo-600 hover:bg-indigo-500 text-white">
            <Link to={`/vagas/${vaga.id}/editar`}>
              <Pencil className="h-4 w-4 mr-2" /> Editar Vaga
            </Link>
          </Button>
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
              {VACANCY_PIPELINE_STAGES.map((stage, idx) => {
                const isPassed = idx < currentStageIndex
                const isCurrent = idx === currentStageIndex

                return (
                  <div
                    key={stage}
                    className={`p-2.5 rounded-lg border text-center transition-all ${
                      isCurrent
                        ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs'
                        : isPassed
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-1">
                      {isPassed && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      )}
                      <span className="text-xs truncate">{stage}</span>
                    </div>
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
        totalVacanciesWithoutPreApproved={preApprovedCount === 0 ? 1 : 0}
        totalVacancies={1}
        totalCandidates={candidates.length}
        totalPreApprovedCandidates={preApprovedCount}
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-slate-500 text-sm">
                      Nenhum candidato vinculado a esta vaga ainda.
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
                          {cand.nome}
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
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline History Log */}
      <Card className="border-slate-200 shadow-2xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <History className="h-5 w-5 text-purple-600" />
            <span>Histórico do Pipeline</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Registro auditável de todas as movimentações desta vaga
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

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Status Inicial</Label>
              <Select
                value={statusCandidato}
                onValueChange={(v) => setStatusCandidato(v as CandidateStatus)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Em análise do gestor">Em análise do gestor</SelectItem>
                  <SelectItem value="Pré-Aprovado">Pré-Aprovado</SelectItem>
                  <SelectItem value="Integrado">Integrado</SelectItem>
                  <SelectItem value="Desistiu">Desistiu</SelectItem>
                  <SelectItem value="Não aprovado">Não aprovado</SelectItem>
                  <SelectItem value="Rejeitado">Rejeitado</SelectItem>
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

      {/* Move Pipeline Modal */}
      <Dialog open={pipelineModalOpen} onOpenChange={setPipelineModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mover Vaga de Etapa</DialogTitle>
            <DialogDescription>Altere a fase do processo seletivo</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <Select value={nextStatus} onValueChange={(v) => setNextStatus(v as VacancyStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                {VACANCY_PIPELINE_STAGES.map((st) => (
                  <SelectItem key={st} value={st}>
                    {st}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPipelineModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleMovePipeline}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
