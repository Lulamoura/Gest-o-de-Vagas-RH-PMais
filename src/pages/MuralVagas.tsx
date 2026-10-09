import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  LayoutGrid,
  Search,
  Filter,
  XCircle,
  MapPin,
  Building2,
  Users,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Sparkles,
  Briefcase,
  FileText,
} from 'lucide-react'
import { getVacancies } from '@/services/vacancies'
import { getCandidates } from '@/services/candidates'
import { useRealtime } from '@/hooks/use-realtime'
import { getPriorityBadgeClass, calculateDaysOpen } from '@/lib/status-utils'
import type { VacancyRecord, CandidateRecord } from '@/types'

export function MuralVagas() {
  const navigate = useNavigate()
  const [vacancies, setVacancies] = useState<VacancyRecord[]>([])
  const [candidates, setCandidates] = useState<CandidateRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros locais
  const [search, setSearch] = useState('')
  const [clientFilter, setClientFilter] = useState('ALL')
  const [priorityFilter, setPriorityFilter] = useState('ALL')
  const [completionFilter, setCompletionFilter] = useState<'ALL' | 'complete' | 'in_progress'>(
    'ALL',
  )

  // Controle de expansão de especificações por vaga (card)
  const [expandedDescIds, setExpandedDescIds] = useState<Record<string, boolean>>({})

  const toggleExpandDesc = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedDescIds((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const loadData = async () => {
    try {
      const [vacs, cands] = await Promise.all([getVacancies(), getCandidates()])
      setVacancies(vacs)
      setCandidates(cands)
    } catch (err) {
      console.error('Erro ao carregar dados do Mural de Vagas:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('vacancies', () => {
    loadData()
  })
  useRealtime('candidates', () => {
    loadData()
  })

  // Escopo estrito do requisito: apenas vagas com status_vaga = "Aberta"
  const openVacancies = useMemo(() => {
    return vacancies.filter((v) => v.status_vaga === 'Aberta')
  }, [vacancies])

  // Métricas agregadas por vaga
  // - integrados: candidatos com status_candidato = "Integrado"
  // - atendidos: candidatos que seguiram no processo (status diferente de "Desclassificado", "Desistente" e "Em banco")
  // - total vinculados: todos os candidatos vinculados no banco àquela vaga
  // - curriculos: wordpress_curriculos_count ?? candidatos vinculados
  const vacancyMetrics = useMemo(() => {
    const map = new Map<
      string,
      {
        integrados: number
        atendidos: number
        totalVinculados: number
      }
    >()

    candidates.forEach((cand) => {
      const vId = cand.vacancy_id
      if (!vId) return

      const curr = map.get(vId) || { integrados: 0, atendidos: 0, totalVinculados: 0 }
      curr.totalVinculados += 1

      if (cand.status_candidato === 'Integrado') {
        curr.integrados += 1
      }

      // Candidatos atendidos que seguiram no pipeline
      if (!['Desclassificado', 'Desistente', 'Em banco'].includes(cand.status_candidato)) {
        curr.atendidos += 1
      }

      map.set(vId, curr)
    })

    return map
  }, [candidates])

  // Lista única de clientes presentes nas vagas abertas para o filtro
  const uniqueClients = useMemo(() => {
    const map = new Map<string, string>()
    openVacancies.forEach((v) => {
      if (v.cliente) {
        map.set(v.cliente, v.expand?.cliente?.nome || v.cliente)
      }
    })
    return Array.from(map, ([id, name]) => ({ id, name }))
  }, [openVacancies])

  // Filtragem dos cards
  const filteredVacancies = useMemo(() => {
    return openVacancies.filter((v) => {
      const cargoNome = v.expand?.cargo?.nome || ''
      const clienteNome = v.expand?.cliente?.nome || ''
      const cidadeNome = v.expand?.cidade?.nome || ''
      const especs = v.especificacoes || ''

      const matchesSearch =
        search === '' ||
        cargoNome.toLowerCase().includes(search.toLowerCase()) ||
        clienteNome.toLowerCase().includes(search.toLowerCase()) ||
        cidadeNome.toLowerCase().includes(search.toLowerCase()) ||
        especs.toLowerCase().includes(search.toLowerCase())

      const matchesClient = clientFilter === 'ALL' || v.cliente === clientFilter
      const matchesPriority = priorityFilter === 'ALL' || v.prioridade === priorityFilter

      const metrics = vacancyMetrics.get(v.id) || {
        integrados: 0,
        atendidos: 0,
        totalVinculados: 0,
      }
      const totalVagas = v.quantidade_vagas || 0
      const isComplete = totalVagas > 0 && metrics.integrados >= totalVagas

      let matchesCompletion = true
      if (completionFilter === 'complete') {
        matchesCompletion = isComplete
      } else if (completionFilter === 'in_progress') {
        matchesCompletion = !isComplete
      }

      return matchesSearch && matchesClient && matchesPriority && matchesCompletion
    })
  }, [openVacancies, search, clientFilter, priorityFilter, completionFilter, vacancyMetrics])

  const clearFilters = () => {
    setSearch('')
    setClientFilter('ALL')
    setPriorityFilter('ALL')
    setCompletionFilter('ALL')
  }

  // Resumo do cabeçalho
  const totalPosicoesAbertas = useMemo(() => {
    return openVacancies.reduce((acc, v) => acc + (v.quantidade_vagas || 0), 0)
  }, [openVacancies])

  const totalPosicoesPreenchidas = useMemo(() => {
    return openVacancies.reduce((acc, v) => {
      const m = vacancyMetrics.get(v.id)
      return acc + (m?.integrados || 0)
    }, 0)
  }, [openVacancies, vacancyMetrics])

  const vagasProntasParaConcluir = useMemo(() => {
    return openVacancies.filter((v) => {
      const total = v.quantidade_vagas || 0
      const integrados = vacancyMetrics.get(v.id)?.integrados || 0
      return total > 0 && integrados >= total
    }).length
  }, [openVacancies, vacancyMetrics])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
        <p className="text-xs text-slate-500 font-medium">Carregando Mural de Vagas...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-sm">
              <LayoutGrid className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Mural de Vagas
                <Badge
                  variant="outline"
                  className="bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold text-xs"
                >
                  {openVacancies.length}{' '}
                  {openVacancies.length === 1 ? 'vaga aberta' : 'vagas abertas'}
                </Badge>
              </h2>
              <p className="text-xs text-slate-500">
                Gestão à vista do time de RH — acompanhe o progresso de fechamento e atração em
                tempo real
              </p>
            </div>
          </div>
        </div>

        {/* Resumo Rápido */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-2xs text-left">
            <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">
              Posições
            </span>
            <span className="text-sm font-bold text-slate-800">
              {totalPosicoesPreenchidas}{' '}
              <span className="text-xs font-normal text-slate-500">
                / {totalPosicoesAbertas} preenchidas
              </span>
            </span>
          </div>

          {vagasProntasParaConcluir > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 shadow-2xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-700 block leading-tight">
                  Prontas para Concluir
                </span>
                <span className="text-sm font-bold text-emerald-800">
                  {vagasProntasParaConcluir} {vagasProntasParaConcluir === 1 ? 'vaga' : 'vagas'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Barra de Filtros */}
      <Card className="border-slate-200 shadow-2xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
            <Filter className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              Filtros do Mural
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por cargo, cliente, cidade ou requisitos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os Clientes</SelectItem>
                {uniqueClients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas as Prioridades</SelectItem>
                <SelectItem value="Alta">Alta</SelectItem>
                <SelectItem value="Média">Média</SelectItem>
                <SelectItem value="Baixa">Baixa</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={completionFilter}
              onValueChange={(val) =>
                setCompletionFilter(val as 'ALL' | 'complete' | 'in_progress')
              }
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Preenchimento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas as Vagas</SelectItem>
                <SelectItem value="in_progress">Em Aberto (Pendentes)</SelectItem>
                <SelectItem value="complete">100% Preenchidas (Prontas)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(search ||
            clientFilter !== 'ALL' ||
            priorityFilter !== 'ALL' ||
            completionFilter !== 'ALL') && (
            <div className="flex justify-end pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-xs text-rose-600 hover:text-rose-700 h-7"
              >
                <XCircle className="h-3.5 w-3.5 mr-1" /> Limpar Filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grade de Cards das Vagas Abertas */}
      {filteredVacancies.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 bg-white shadow-none">
          <CardContent className="p-12 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <Briefcase className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">
                Nenhuma vaga aberta encontrada
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {openVacancies.length === 0
                  ? 'Não há vagas no status "Aberta" no momento.'
                  : 'Nenhuma vaga corresponde aos filtros selecionados. Tente ajustar a busca.'}
              </p>
            </div>
            {(search ||
              clientFilter !== 'ALL' ||
              priorityFilter !== 'ALL' ||
              completionFilter !== 'ALL') && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="text-xs">
                Limpar Filtros
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredVacancies.map((vaga) => {
            const metrics = vacancyMetrics.get(vaga.id) || {
              integrados: 0,
              atendidos: 0,
              totalVinculados: 0,
            }
            const totalSolicitado = vaga.quantidade_vagas || 0
            const preenchidas = metrics.integrados
            const isFull = totalSolicitado > 0 && preenchidas >= totalSolicitado
            const progressPercent =
              totalSolicitado > 0
                ? Math.min(100, Math.round((preenchidas / totalSolicitado) * 100))
                : 0

            // Relação solicitada pelo usuário: "Candidatos Atendidos / Currículos atraídos"
            // - Candidatos Atendidos: candidatos que seguiram no processo
            // - Currículos atraídos: total atraído do site (wordpress_curriculos_count) ou total de vinculados se maior/ausente
            const curriculosAtraidos =
              vaga.wordpress_curriculos_count != null && vaga.wordpress_curriculos_count > 0
                ? vaga.wordpress_curriculos_count
                : metrics.totalVinculados

            const isExpanded = !!expandedDescIds[vaga.id]
            const rawSpecs = vaga.especificacoes?.trim() || ''
            const hasLongSpecs = rawSpecs.length > 140

            const cargoNome = vaga.expand?.cargo?.nome || 'Cargo não informado'
            const clienteNome = vaga.expand?.cliente?.nome || 'Cliente não informado'
            const cidadeNome = vaga.expand?.cidade?.nome || vaga.cidade || null
            const diasAbertos = calculateDaysOpen(vaga.data_abertura)

            return (
              <Card
                key={vaga.id}
                onClick={() => navigate(`/vagas/${vaga.id}`)}
                className={`group cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 border flex flex-col justify-between ${
                  isFull
                    ? 'border-emerald-300 bg-gradient-to-b from-emerald-50/30 via-white to-white'
                    : 'border-slate-200 bg-white hover:border-indigo-300'
                }`}
              >
                <div>
                  {/* Topo do Card: Alerta sutil quando 100% preenchida */}
                  {isFull && (
                    <div className="bg-emerald-100/80 border-b border-emerald-200 text-emerald-800 text-[11px] font-semibold px-4 py-1.5 flex items-center justify-between rounded-t-xl">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        Pronta para concluir — todas as posições preenchidas!
                      </span>
                      <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                  )}

                  <CardHeader className="p-4 pb-3 space-y-2">
                    {/* Linha de Badges (Prioridade + Cidade) */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {vaga.prioridade && (
                          <Badge
                            variant="outline"
                            className={`${getPriorityBadgeClass(vaga.prioridade)} text-[10px] px-2 py-0.5`}
                          >
                            Prioridade {vaga.prioridade}
                          </Badge>
                        )}
                        {cidadeNome && (
                          <Badge
                            variant="outline"
                            className="bg-slate-50 text-slate-600 border-slate-200 text-[10px] px-2 py-0.5 flex items-center gap-1 font-normal"
                          >
                            <MapPin className="h-2.5 w-2.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[120px]">{cidadeNome}</span>
                          </Badge>
                        )}
                      </div>

                      <span className="text-[10px] font-medium text-slate-400">
                        {diasAbertos} {diasAbertos === 1 ? 'dia aberto' : 'dias abertos'}
                      </span>
                    </div>

                    {/* Cargo em destaque */}
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug line-clamp-2">
                        {cargoNome}
                      </CardTitle>
                      {/* Cliente */}
                      <p className="text-xs font-semibold text-slate-600 mt-1 flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{clienteNome}</span>
                      </p>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 pt-0 space-y-3">
                    {/* Descrição resumida com "ver mais" / expansão */}
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 text-xs text-slate-600">
                      <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-slate-400 mb-1">
                        <FileText className="h-3 w-3 text-slate-400" />
                        <span>Especificações</span>
                      </div>
                      {rawSpecs ? (
                        <div>
                          <p
                            className={`whitespace-pre-line text-slate-700 leading-relaxed ${
                              !isExpanded && hasLongSpecs ? 'line-clamp-2' : ''
                            }`}
                          >
                            {rawSpecs}
                          </p>
                          {hasLongSpecs && (
                            <button
                              type="button"
                              onClick={(e) => toggleExpandDesc(vaga.id, e)}
                              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-0.5 mt-1 focus:outline-hidden"
                            >
                              {isExpanded ? (
                                <>
                                  <span>ver menos</span>
                                  <ChevronUp className="h-3 w-3" />
                                </>
                              ) : (
                                <>
                                  <span>ver mais</span>
                                  <ChevronDown className="h-3 w-3" />
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="italic text-slate-400">Sem especificações cadastradas.</p>
                      )}
                    </div>

                    {/* Indicador de posições: preenchidas / solicitadas */}
                    <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                          Posições
                        </span>
                        <span
                          className={`font-bold text-xs ${
                            isFull ? 'text-emerald-700' : 'text-slate-800'
                          }`}
                        >
                          {preenchidas} / {totalSolicitado}{' '}
                          <span className="font-normal text-slate-500">({progressPercent}%)</span>
                        </span>
                      </div>

                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 rounded-full ${
                            isFull ? 'bg-emerald-500' : 'bg-indigo-600'
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Relação SOLICITADA PELO USUÁRIO: "Candidatos Atendidos / Currículos atraídos" */}
                    <div className="bg-indigo-50/60 border border-indigo-100 rounded-lg p-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                          <span className="text-[11px] font-bold uppercase tracking-wide text-indigo-950">
                            Candidatos Atendidos / Currículos
                          </span>
                        </div>
                      </div>

                      <div className="mt-1 flex items-baseline justify-between">
                        <div className="text-sm font-extrabold text-indigo-900">
                          {metrics.atendidos}{' '}
                          <span className="text-xs font-medium text-indigo-700">
                            {metrics.atendidos === 1 ? 'atendido' : 'atendidos'}
                          </span>
                          <span className="text-slate-400 font-normal mx-1.5">/</span>
                          <span className="text-slate-700 font-bold">
                            {curriculosAtraidos}{' '}
                            <span className="text-xs font-normal text-slate-500">
                              {curriculosAtraidos === 1 ? 'currículo' : 'currículos'}
                            </span>
                          </span>
                        </div>

                        {curriculosAtraidos > 0 && (
                          <span className="text-[10px] font-bold text-indigo-600 bg-white px-1.5 py-0.5 rounded border border-indigo-200">
                            {Math.round((metrics.atendidos / curriculosAtraidos) * 100)}% conv.
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Relação de candidatos em processo sobre currículos atraídos
                      </span>
                    </div>
                  </CardContent>
                </div>

                {/* Rodapé do Card com ação de navegar */}
                <div className="px-4 py-2.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs text-indigo-600 font-semibold group-hover:bg-indigo-50/50 transition-colors rounded-b-xl">
                  <span>Abrir ficha da vaga</span>
                  <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default MuralVagas
