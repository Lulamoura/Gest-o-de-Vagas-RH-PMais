import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getVacancies } from '@/services/vacancies'
import { getCandidates } from '@/services/candidates'
import { getClientes } from '@/services/clientes'
import { VacancyRecord, CandidateRecord, ClienteRecord } from '@/types'
import { useRealtime } from '@/hooks/use-realtime'
import { MandatoryIndicatorCard } from '@/components/MandatoryIndicatorCard'
import { calculateDaysOpen, formatCurrency, CANDIDATE_STATUS_TO_PHASE } from '@/lib/status-utils'
import { isVacancyOverdue } from '@/lib/vacancy-overdue'
import { OverdueVacancyIcon } from '@/components/OverdueVacancyIcon'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import {
  Briefcase,
  CheckCircle,
  Clock,
  Users,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Building2,
  PlusCircle,
  BarChart2,
  Star,
  Filter,
  XCircle,
  FileDown,
  DollarSign,
} from 'lucide-react'
import { StarRating } from '@/components/StarRating'
import { getFilterSummary } from '@/lib/print-utils'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'

const PIE_COLORS = ['#3b82f6', '#a855f7', '#f59e0b', '#6366f1', '#06b6d4', '#10b981', '#94a3b8']

export default function Dashboard() {
  const [vacancies, setVacancies] = useState<VacancyRecord[]>([])
  const [candidates, setCandidates] = useState<CandidateRecord[]>([])
  const [clientesList, setClientesList] = useState<ClienteRecord[]>([])
  const [loading, setLoading] = useState(true)

  const [monthFilter, setMonthFilter] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [clientFilter, setClientFilter] = useState('ALL')

  const loadData = async () => {
    try {
      const [vData, cData, clData] = await Promise.all([
        getVacancies(),
        getCandidates(),
        getClientes(),
      ])
      setVacancies(vData)
      setCandidates(cData)
      setClientesList(clData)
    } catch (err) {
      console.error(err)
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
  const dateRange = useMemo(() => {
    if (periodStart && periodEnd) {
      return {
        start: new Date(periodStart + 'T00:00:00'),
        end: new Date(periodEnd + 'T23:59:59'),
      }
    }
    if (monthFilter) {
      const [year, month] = monthFilter.split('-').map(Number)
      return {
        start: new Date(year, month - 1, 1),
        end: new Date(year, month, 0, 23, 59, 59),
      }
    }
    return {
      start: new Date('2000-01-01'),
      end: new Date('2100-12-31'),
    }
  }, [monthFilter, periodStart, periodEnd])

  const filteredVacancies = useMemo(() => {
    return vacancies.filter((v) => {
      const vacancyDate = new Date(v.data_abertura || v.created)
      if (vacancyDate < dateRange.start || vacancyDate > dateRange.end) return false
      if (clientFilter !== 'ALL' && v.cliente !== clientFilter) return false
      return true
    })
  }, [vacancies, dateRange, clientFilter])

  const filteredCandidates = useMemo(() => {
    const vacancyIds = new Set(filteredVacancies.map((v) => v.id))
    return candidates.filter((c) => vacancyIds.has(c.vacancy_id))
  }, [candidates, filteredVacancies])

  const openVacancies = useMemo(() => {
    return filteredVacancies.filter(
      (v) => v.status_vaga !== 'Concluída' && v.status_vaga !== 'Cancelada',
    )
  }, [filteredVacancies])

  const closedVacanciesMonth = useMemo(() => {
    return filteredVacancies.filter((v) => v.status_vaga === 'Concluída')
  }, [filteredVacancies])

  const averageClosingDays = useMemo(() => {
    if (closedVacanciesMonth.length === 0) return 22
    const totalDays = closedVacanciesMonth.reduce(
      (acc, v) => acc + calculateDaysOpen(v.data_abertura, v.data_fechamento),
      0,
    )
    return Math.round(totalDays / closedVacanciesMonth.length)
  }, [closedVacanciesMonth])

  const delayedVacancies = useMemo(() => {
    return openVacancies.filter((v) => calculateDaysOpen(v.data_abertura) > 30)
  }, [openVacancies])

  const mandatoryIndicatorData = useMemo(() => {
    const totalPosicoes = openVacancies.reduce((acc, v) => acc + (v.quantidade_vagas || 0), 0)
    const candidatosEmProcesso = filteredCandidates.filter(
      (c) =>
        c.vacancy_id && !['Desistente', 'Desclassificado', 'Em banco'].includes(c.status_candidato),
    ).length
    const candidatosIntegrados = filteredCandidates.filter(
      (c) => c.status_candidato === 'Integrado',
    ).length
    return {
      candidatosEmProcesso,
      totalPosicoes,
      candidatosIntegrados,
    }
  }, [openVacancies, filteredCandidates])

  const conversionRateData = useMemo(() => {
    const integrados = filteredCandidates.filter((c) => c.status_candidato === 'Integrado').length
    const total = filteredCandidates.length
    const taxa = total > 0 ? (integrados / total) * 100 : 0
    return { integrados, total, taxa }
  }, [filteredCandidates])

  const statusChartData = useMemo(() => {
    const counts: Record<string, number> = {}
    filteredVacancies.forEach((v) => {
      counts[v.status_vaga] = (counts[v.status_vaga] || 0) + 1
    })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [filteredVacancies])

  const candidatesPerPhaseData = useMemo(() => {
    const phaseCounts: Record<string, number> = {
      Triagem: 0,
      Entrevistas: 0,
      'Pré-Aprovação': 0,
      Contratação: 0,
      Fechada: 0,
    }
    filteredCandidates.forEach((c) => {
      const phase = CANDIDATE_STATUS_TO_PHASE[c.status_candidato]
      if (phase && phase in phaseCounts) {
        phaseCounts[phase]++
      }
    })
    return Object.entries(phaseCounts).map(([fase, total]) => ({ fase, total }))
  }, [filteredCandidates])

  const rankingPerVacancy = useMemo(() => {
    const vacancyRankMap: Record<
      string,
      { avg: number; count: number; cargo: string; cliente: string; contrato: string }
    > = {}
    filteredCandidates.forEach((c) => {
      if (c.rank == null) return
      const vId = c.vacancy_id
      if (!vacancyRankMap[vId]) {
        const vacancy = filteredVacancies.find((v) => v.id === vId)
        vacancyRankMap[vId] = {
          avg: 0,
          count: 0,
          cargo: vacancy?.expand?.cargo?.nome || '—',
          cliente: vacancy?.expand?.cliente?.nome || '—',
          contrato: vacancy?.expand?.tipo_contrato?.nome || '—',
        }
      }
      vacancyRankMap[vId].avg += c.rank
      vacancyRankMap[vId].count += 1
    })
    return Object.entries(vacancyRankMap)
      .map(([vId, data]) => ({
        vId,
        cargo: data.cargo,
        cliente: data.cliente,
        contrato: data.contrato,
        avgRank: Math.round((data.avg / data.count) * 10) / 10,
        count: data.count,
      }))
      .sort((a, b) => b.avgRank - a.avgRank)
  }, [filteredCandidates, filteredVacancies])

  const overallAverageRank = useMemo(() => {
    const ranked = filteredCandidates.filter((c) => c.rank != null)
    if (ranked.length === 0) return 0
    const total = ranked.reduce((acc, c) => acc + (c.rank || 0), 0)
    return Math.round((total / ranked.length) * 10) / 10
  }, [filteredCandidates])

  const stalledVacancies = useMemo(() => {
    return openVacancies
      .map((v) => ({ ...v, diasParado: calculateDaysOpen(v.data_abertura) }))
      .sort((a, b) => b.diasParado - a.diasParado)
      .slice(0, 5)
  }, [openVacancies])

  const vacanciesByTypeData = useMemo(() => {
    const counts: Record<string, number> = {}
    openVacancies.forEach((v) => {
      const tipo = v.expand?.tipo_vaga?.nome
      if (!tipo) return
      counts[tipo] = (counts[tipo] || 0) + 1
    })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [openVacancies])

  const totalAccumulatedCost = useMemo(() => {
    const candidateCosts = filteredCandidates.reduce(
      (acc, c) =>
        acc +
        (c.custo_consultas || 0) +
        (c.custo_exames || 0) +
        (c.custo_testes || 0) +
        (c.custo_extras || 0),
      0,
    )
    const vacancyExpenses = filteredVacancies.reduce((acc, v) => acc + (v.despesas_vaga || 0), 0)
    return candidateCosts + vacancyExpenses
  }, [filteredCandidates, filteredVacancies])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs print:hidden">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Visão Geral de RH</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Acompanhamento de processos seletivos, prazos e KPIs operacionais da PMais.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button asChild className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm">
            <Link to="/vagas/nova">
              <PlusCircle className="h-4 w-4 mr-2" /> Nova Vaga
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-slate-200">
            <Link to="/relatorios">
              <BarChart2 className="h-4 w-4 mr-2" /> Exportar Relatório
            </Link>
          </Button>
          <Button onClick={() => window.print()} variant="outline" className="border-slate-200">
            <FileDown className="h-4 w-4 mr-2" /> Exportar em PDF
          </Button>
        </div>
      </div>

      <div className="hidden print:block mb-4 border-b-2 border-slate-900 pb-3">
        <h1 className="text-xl font-bold text-slate-900">Dashboard de RH — PMais</h1>
        <p className="text-[10pt] text-slate-600 mt-1">
          {getFilterSummary(monthFilter, periodStart, periodEnd, clientFilter, clientesList)}
        </p>
      </div>

      {/* Filter Bar */}
      <Card className="border-slate-200 shadow-2xs print:hidden">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
            <Filter className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              Filtros de Período e Contrato
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-slate-500 font-semibold">Mês</Label>
              <Input
                type="month"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="h-9 text-xs"
                disabled={!!(periodStart && periodEnd)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-slate-500 font-semibold">Período - Início</Label>
              <Input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-slate-500 font-semibold">Período - Fim</Label>
              <Input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-slate-500 font-semibold">Cliente</Label>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os Clientes</SelectItem>
                  {clientesList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {(periodStart || periodEnd) && (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPeriodStart('')
                  setPeriodEnd('')
                }}
                className="text-xs text-rose-600 hover:text-rose-700 h-7"
              >
                <XCircle className="h-3.5 w-3.5 mr-1" /> Limpar Período
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <MandatoryIndicatorCard
        candidatosEmProcesso={mandatoryIndicatorData.candidatosEmProcesso}
        totalPosicoes={mandatoryIndicatorData.totalPosicoes}
        candidatosIntegrados={mandatoryIndicatorData.candidatosIntegrados}
      />

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-2xs hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Vagas Abertas
              </span>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Briefcase className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-slate-900">{openVacancies.length}</span>
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                Em andamento
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Concluídas no Mês
              </span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <CheckCircle className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-slate-900">
                {closedVacanciesMonth.length}
              </span>
              <span className="text-xs font-medium text-emerald-600 flex items-center">
                <TrendingUp className="h-3 w-3 mr-1" /> Meta atingida
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Tempo Médio Fechamento
              </span>
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                <Clock className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-slate-900">{averageClosingDays}</span>
              <span className="text-xs font-medium text-slate-500">dias corridos</span>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`border-slate-200 shadow-2xs hover:shadow-md transition-shadow ${delayedVacancies.length > 0 ? 'bg-rose-50/40 border-rose-200' : ''}`}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Vagas em Atraso
              </span>
              <div
                className={`p-2 rounded-lg ${delayedVacancies.length > 0 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'}`}
              >
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span
                className={`text-3xl font-extrabold ${delayedVacancies.length > 0 ? 'text-rose-600' : 'text-slate-900'}`}
              >
                {delayedVacancies.length}
              </span>
              {delayedVacancies.length > 0 && (
                <Badge variant="destructive" className="text-[10px] px-2">
                  Ação necessária
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-slate-200 shadow-2xs hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Taxa de Conversão
              </span>
              <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-slate-900">
                {conversionRateData.total > 0
                  ? conversionRateData.taxa.toFixed(1).replace('.', ',') + '%'
                  : '—'}
              </span>
              <span className="text-xs font-medium text-teal-600 bg-teal-50 px-2 py-0.5 rounded">
                {conversionRateData.total > 0
                  ? `${conversionRateData.integrados}/${conversionRateData.total}`
                  : 'Sem dados'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Ranking Médio Geral
              </span>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-slate-900">
                {overallAverageRank > 0 ? overallAverageRank : '—'}
              </span>
              <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                {overallAverageRank > 0 ? '/ 5 estrelas' : 'Sem dados'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-slate-900">Vagas por Status</CardTitle>
            <CardDescription className="text-xs">
              Distribuição atual das vagas em cada etapa do pipeline
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {statusChartData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: number) => [`${val} vaga(s)`, 'Quantidade']}
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-slate-900">
              Candidatos por Fase do Pipeline
            </CardTitle>
            <CardDescription className="text-xs">
              Quantidade de candidatos em cada etapa do pipeline
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            {filteredCandidates.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Users className="h-10 w-10 text-slate-300 mb-3" />
                <p className="text-sm font-medium text-slate-500">Nenhum candidato encontrado</p>
                <p className="text-xs text-slate-400 mt-1">
                  O gráfico será atualizado quando houver candidatos no período filtrado
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={candidatesPerPhaseData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="fase" stroke="#64748b" fontSize={11} interval={0} />
                  <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    formatter={(val: number) => [`${val} candidato(s)`, 'Quantidade']}
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="total" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ranking per vacancy */}
      {rankingPerVacancy.length > 0 && (
        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
              <span>Ranking Médio por Vaga</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Média de estrelas dos candidatos em cada vaga
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-xs font-semibold text-slate-600">Cargo</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Cliente</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Contrato</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Candidatos</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">
                    Ranking Médio
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankingPerVacancy.map((rv) => (
                  <TableRow key={rv.vId} className="hover:bg-slate-50">
                    <TableCell className="font-semibold text-slate-900 text-sm">
                      {rv.cargo}
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm">{rv.cliente}</TableCell>
                    <TableCell className="text-slate-600 text-sm">{rv.contrato}</TableCell>
                    <TableCell className="text-slate-600 text-sm">{rv.count}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StarRating value={rv.avgRank} readOnly size={14} />
                        <span className="text-xs font-bold text-amber-700">{rv.avgRank}/5</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Vacancies by Type Chart + Total Accumulated Cost */}
      {vacanciesByTypeData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="border-slate-200 shadow-2xs lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold text-slate-900">Vagas por Tipo</CardTitle>
              <CardDescription className="text-xs">
                Distribuição das vagas abertas por tipo de vaga
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={vacanciesByTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {vacanciesByTypeData.map((_entry, index) => (
                      <Cell
                        key={`cell-type-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => [`${val} vaga(s)`, 'Quantidade']}
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-2xs lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <DollarSign className="h-5 w-5 text-emerald-600" />
                <span>Custo Total Acumulado</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Soma de todos os custos de candidatos no período
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-center">
                <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider block">
                  Investimento Total
                </span>
                <span className="text-3xl font-black text-emerald-700 mt-1 block">
                  {formatCurrency(totalAccumulatedCost)}
                </span>
              </div>
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>Consultas:</span>
                  <span className="font-semibold">
                    {formatCurrency(
                      filteredCandidates.reduce((a, b) => a + (b.custo_consultas || 0), 0),
                    )}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>Exames Admissionais:</span>
                  <span className="font-semibold">
                    {formatCurrency(
                      filteredCandidates.reduce((a, b) => a + (b.custo_exames || 0), 0),
                    )}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>Testes / Avaliações:</span>
                  <span className="font-semibold">
                    {formatCurrency(
                      filteredCandidates.reduce((a, b) => a + (b.custo_testes || 0), 0),
                    )}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Extras / Deslocamento:</span>
                  <span className="font-semibold">
                    {formatCurrency(
                      filteredCandidates.reduce((a, b) => a + (b.custo_extras || 0), 0),
                    )}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stalled Vacancies */}
      <Card className="border-slate-200 shadow-2xs">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <span>Vagas Paradas há +Dias</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Vagas abertas com maior tempo no pipeline
            </CardDescription>
          </div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-indigo-600 text-xs print:hidden"
          >
            <Link to="/vagas">
              Ver todas <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-xs font-semibold text-slate-600">Cargo</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Cliente</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Contrato</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">
                    Dias Parado
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">
                    Responsável RH
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 text-right">
                    Ação
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stalledVacancies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-slate-500 text-sm">
                      Nenhuma vaga parada encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  stalledVacancies.map((vaga) => (
                    <TableRow key={vaga.id} className="hover:bg-slate-50">
                      <TableCell className="font-semibold text-slate-900 text-sm">
                        <div className="flex items-center gap-1.5">
                          {isVacancyOverdue(vaga) && (
                            <OverdueVacancyIcon iconClassName="h-3.5 w-3.5" />
                          )}
                          {vaga.expand?.cargo?.nome || '—'}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">
                        <div className="flex items-center space-x-1.5">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          <span>{vaga.expand?.cliente?.nome || '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">
                        {vaga.expand?.tipo_contrato?.nome || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            vaga.diasParado > 30
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }
                        >
                          {vaga.diasParado} dias
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">
                        {vaga.expand?.responsavel_rh?.name || 'Não atribuído'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs print:hidden"
                        >
                          <Link to={`/vagas/${vaga.id}`}>Ver Detalhes</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
