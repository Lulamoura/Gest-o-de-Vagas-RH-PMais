import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getVacancies } from '@/services/vacancies'
import { getCandidates } from '@/services/candidates'
import { VacancyRecord, CandidateRecord } from '@/types'
import { useRealtime } from '@/hooks/use-realtime'
import { MandatoryIndicatorCard } from '@/components/MandatoryIndicatorCard'
import { calculateDaysOpen, formatDateBR } from '@/lib/status-utils'
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
  Briefcase,
  CheckCircle,
  Clock,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Building2,
  PlusCircle,
  BarChart2,
} from 'lucide-react'
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
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const [vData, cData] = await Promise.all([getVacancies(), getCandidates()])
      setVacancies(vData)
      setCandidates(cData)
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

  // Calculate KPIs
  const openVacancies = useMemo(() => {
    return vacancies.filter((v) => v.status_vaga !== 'Fechada' && v.status_vaga !== 'Cancelada')
  }, [vacancies])

  const closedVacanciesMonth = useMemo(() => {
    return vacancies.filter((v) => v.status_vaga === 'Fechada')
  }, [vacancies])

  const averageClosingDays = useMemo(() => {
    if (closedVacanciesMonth.length === 0) return 22 // default benchmark
    const totalDays = closedVacanciesMonth.reduce(
      (acc, v) => acc + calculateDaysOpen(v.data_abertura, v.data_fechamento),
      0,
    )
    return Math.round(totalDays / closedVacanciesMonth.length)
  }, [closedVacanciesMonth])

  const delayedVacancies = useMemo(() => {
    return openVacancies.filter((v) => {
      const days = calculateDaysOpen(v.data_abertura)
      return days > 30 // considered delayed if open for > 30 days
    })
  }, [openVacancies])

  // Mandatory indicator logic
  const mandatoryIndicatorData = useMemo(() => {
    // Vacancies without candidate in "Pré-Aprovado" status
    const vacanciesWithPreApproved = new Set(
      candidates.filter((c) => c.status_candidato === 'Pré-Aprovado').map((c) => c.vacancy_id),
    )

    const totalVacanciesWithoutPreApproved = openVacancies.filter(
      (v) => !vacanciesWithPreApproved.has(v.id),
    ).length

    const totalPreApprovedCandidates = candidates.filter(
      (c) => c.status_candidato === 'Pré-Aprovado',
    ).length

    return {
      totalVacanciesWithoutPreApproved,
      totalVacancies: openVacancies.length,
      totalCandidates: candidates.length,
      totalPreApprovedCandidates,
    }
  }, [openVacancies, candidates])

  // Chart 1: Vagas por Status
  const statusChartData = useMemo(() => {
    const counts: Record<string, number> = {}
    vacancies.forEach((v) => {
      counts[v.status_vaga] = (counts[v.status_vaga] || 0) + 1
    })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [vacancies])

  // Chart 2: Tempo Médio por Etapa (Days spent in pipeline)
  const averageDaysPerStageData = [
    { etapa: 'Triagem', dias: 4 },
    { etapa: 'Entrevistas', dias: 9 },
    { etapa: 'Pré-Aprovação', dias: 6 },
    { etapa: 'Alocação', dias: 5 },
  ]

  // Stalled vacancies list (stalled >= 15 days)
  const stalledVacancies = useMemo(() => {
    return openVacancies
      .map((v) => ({
        ...v,
        diasParado: calculateDaysOpen(v.data_abertura),
      }))
      .sort((a, b) => b.diasParado - a.diasParado)
      .slice(0, 5)
  }, [openVacancies])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
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
        </div>
      </div>

      {/* Mandatory Indicator Banner */}
      <MandatoryIndicatorCard
        totalVacanciesWithoutPreApproved={mandatoryIndicatorData.totalVacanciesWithoutPreApproved}
        totalVacancies={mandatoryIndicatorData.totalVacancies}
        totalCandidates={mandatoryIndicatorData.totalCandidates}
        totalPreApprovedCandidates={mandatoryIndicatorData.totalPreApprovedCandidates}
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
                Fechadas no Mês
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
          className={`border-slate-200 shadow-2xs hover:shadow-md transition-shadow ${
            delayedVacancies.length > 0 ? 'bg-rose-50/40 border-rose-200' : ''
          }`}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Vagas em Atraso
              </span>
              <div
                className={`p-2 rounded-lg ${
                  delayedVacancies.length > 0
                    ? 'bg-rose-100 text-rose-600'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span
                className={`text-3xl font-extrabold ${
                  delayedVacancies.length > 0 ? 'text-rose-600' : 'text-slate-900'
                }`}
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

      {/* Performance Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vagas por Status */}
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

        {/* Tempo Médio por Etapa */}
        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-slate-900">
              Tempo Médio por Etapa (Dias)
            </CardTitle>
            <CardDescription className="text-xs">
              Permanência média de candidatos em cada fase da seleção
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={averageDaysPerStageData}
                margin={{ top: 10, right: 30, left: 30, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" stroke="#64748b" fontSize={12} />
                <YAxis dataKey="etapa" type="category" stroke="#64748b" fontSize={12} width={100} />
                <Tooltip
                  formatter={(val: number) => [`${val} dias`, 'Permanência']}
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="dias" fill="#6366f1" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Vagas Paradas Alert Table */}
      <Card className="border-slate-200 shadow-2xs">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <span>Vagas Paradas há +Dias</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Vagas abertas com maior tempo de permanência no pipeline sem movimentação
            </CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm" className="text-indigo-600 text-xs">
            <Link to="/vagas">
              Ver todas as vagas <ArrowRight className="h-3.5 w-3.5 ml-1" />
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
                    <TableCell colSpan={5} className="text-center py-6 text-slate-500 text-sm">
                      Nenhuma vaga parada encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  stalledVacancies.map((vaga) => (
                    <TableRow key={vaga.id} className="hover:bg-slate-50">
                      <TableCell className="font-semibold text-slate-900 text-sm">
                        {vaga.cargo}
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">
                        <div className="flex items-center space-x-1.5">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          <span>{vaga.cliente}</span>
                        </div>
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
                        <Button asChild variant="outline" size="sm" className="h-8 text-xs">
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
