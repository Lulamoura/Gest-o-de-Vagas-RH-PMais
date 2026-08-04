import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { getIndicatorsSummary, type IndicatorsSummary } from '@/services/indicators'
import { useRealtime } from '@/hooks/use-realtime'
import { useSystemParameters } from '@/hooks/use-system-parameters'
import { MandatoryIndicatorCard } from '@/components/MandatoryIndicatorCard'
import { formatCurrency } from '@/lib/status-utils'
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

const EMPTY_SUMMARY: IndicatorsSummary = {
  openVacancies: 0,
  closedVacancies: 0,
  closedVacanciesMonth: 0,
  averageClosingDays: 0,
  delayedVacancies: 0,
  conversionRate: { integrados: 0, total: 0, taxa: 0 },
  overallAverageRank: 0,
  mandatoryIndicator: { candidatosEmProcesso: 0, totalPosicoes: 0, candidatosIntegrados: 0 },
  statusChart: [],
  candidatesPerPhase: [],
  vacanciesByType: [],
  rankingPerVacancy: [],
  stalledVacancies: [],
  totalAccumulatedCost: 0,
  costBreakdown: { consultas: 0, exames: 0, testes: 0, extras: 0, despesasVaga: 0 },
  totalFilteredCandidates: 0,
  clientes: [],
}

export default function Dashboard() {
  const { parameters } = useSystemParameters()
  const alertThreshold = parameters?.prazo_alerta_dias ?? 30
  const [summary, setSummary] = useState<IndicatorsSummary>(EMPTY_SUMMARY)
  const [loading, setLoading] = useState(true)

  const [monthFilter, setMonthFilter] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [clientFilter, setClientFilter] = useState('ALL')

  const loadData = useCallback(async () => {
    try {
      const data = await getIndicatorsSummary({
        month: monthFilter || undefined,
        periodStart: periodStart || undefined,
        periodEnd: periodEnd || undefined,
        clientId: clientFilter,
        alertThreshold,
      })
      setSummary(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [monthFilter, periodStart, periodEnd, clientFilter, alertThreshold])

  useEffect(() => {
    loadData()
  }, [loadData])

  const loadDataRef = useRef(loadData)
  loadDataRef.current = loadData

  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const debouncedReload = useCallback(() => {
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current)
    reloadTimerRef.current = setTimeout(() => loadDataRef.current(), 500)
  }, [])

  useRealtime('vacancies', debouncedReload)
  useRealtime('candidates', debouncedReload)

  useEffect(() => {
    return () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    )
  }

  const s = summary

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
          {getFilterSummary(monthFilter, periodStart, periodEnd, clientFilter, s.clientes)}
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
                  {s.clientes.map((c) => (
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
        candidatosEmProcesso={s.mandatoryIndicator.candidatosEmProcesso}
        totalPosicoes={s.mandatoryIndicator.totalPosicoes}
        candidatosIntegrados={s.mandatoryIndicator.candidatosIntegrados}
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
              <span className="text-3xl font-extrabold text-slate-900">{s.openVacancies}</span>
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
                {s.closedVacanciesMonth}
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
              <span className="text-3xl font-extrabold text-slate-900">{s.averageClosingDays}</span>
              <span className="text-xs font-medium text-slate-500">dias corridos</span>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`border-slate-200 shadow-2xs hover:shadow-md transition-shadow ${s.delayedVacancies > 0 ? 'bg-rose-50/40 border-rose-200' : ''}`}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Vagas em Atraso
              </span>
              <div
                className={`p-2 rounded-lg ${s.delayedVacancies > 0 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'}`}
              >
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span
                className={`text-3xl font-extrabold ${s.delayedVacancies > 0 ? 'text-rose-600' : 'text-slate-900'}`}
              >
                {s.delayedVacancies}
              </span>
              {s.delayedVacancies > 0 && (
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
                {s.conversionRate.total > 0
                  ? s.conversionRate.taxa.toFixed(1).replace('.', ',') + '%'
                  : '—'}
              </span>
              <span className="text-xs font-medium text-teal-600 bg-teal-50 px-2 py-0.5 rounded">
                {s.conversionRate.total > 0
                  ? `${s.conversionRate.integrados}/${s.conversionRate.total}`
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
                {s.overallAverageRank > 0 ? s.overallAverageRank : '—'}
              </span>
              <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                {s.overallAverageRank > 0 ? '/ 5 estrelas' : 'Sem dados'}
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
                  data={s.statusChart}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {s.statusChart.map((_entry, index) => (
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
            {s.totalFilteredCandidates === 0 ? (
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
                  data={s.candidatesPerPhase}
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
      {s.rankingPerVacancy.length > 0 && (
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
                {s.rankingPerVacancy.map((rv) => (
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
      {s.vacanciesByType.length > 0 && (
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
                    data={s.vacanciesByType}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {s.vacanciesByType.map((_entry, index) => (
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
                  {formatCurrency(s.totalAccumulatedCost)}
                </span>
              </div>
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>Consultas:</span>
                  <span className="font-semibold">{formatCurrency(s.costBreakdown.consultas)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>Exames Admissionais:</span>
                  <span className="font-semibold">{formatCurrency(s.costBreakdown.exames)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>Testes / Avaliações:</span>
                  <span className="font-semibold">{formatCurrency(s.costBreakdown.testes)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Extras / Deslocamento:</span>
                  <span className="font-semibold">{formatCurrency(s.costBreakdown.extras)}</span>
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
                {s.stalledVacancies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-slate-500 text-sm">
                      Nenhuma vaga parada encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  s.stalledVacancies.map((vaga) => (
                    <TableRow key={vaga.id} className="hover:bg-slate-50">
                      <TableCell className="font-semibold text-slate-900 text-sm">
                        <div className="flex items-center gap-1.5">
                          {isVacancyOverdue(
                            {
                              data_abertura: vaga.dataAbertura,
                              prazo_desejado: vaga.prazoDesejado,
                              status_vaga: 'Aberta',
                            } as any,
                            alertThreshold,
                          ) && <OverdueVacancyIcon iconClassName="h-3.5 w-3.5" />}
                          {vaga.cargo || '—'}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">
                        <div className="flex items-center space-x-1.5">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          <span>{vaga.cliente || '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">
                        {vaga.contrato || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            vaga.diasParado > alertThreshold
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }
                        >
                          {vaga.diasParado} dias
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">
                        {vaga.responsavelRh || 'Não atribuído'}
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
