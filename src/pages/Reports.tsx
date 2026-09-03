import { useState, useEffect, useMemo } from 'react'
import { getVacancies } from '@/services/vacancies'
import { getCandidates } from '@/services/candidates'
import { getClientes } from '@/services/clientes'
import {
  getCandidatoConsultasJuridicas,
  CustoConsultasVagaItem,
} from '@/services/relatorio_consultas'
import {
  VacancyRecord,
  CandidateRecord,
  ClienteRecord,
  CandidatoConsultaJuridicaRecord,
} from '@/types'
import { useRealtime } from '@/hooks/use-realtime'
import {
  formatCurrency,
  getVacancyStatusBadgeClass,
  getCandidateStatusBadgeClass,
} from '@/lib/status-utils'
import { exportToCsv } from '@/lib/csv-export'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
import { Filter, Download, FileText, XCircle, FileDown, DollarSign } from 'lucide-react'
import { renderStarsAsText, getFilterSummary } from '@/lib/print-utils'
import { toast } from 'sonner'

interface ReportRow {
  cliente: string
  cargo: string
  statusVaga: string
  prioridade: string
  candidato: string
  statusCandidato: string
  ranking: string
  custoTotal: string
  tipoContrato: string
  tipoVaga: string
  rankValue: number | null
}

export default function Reports() {
  const [vacancies, setVacancies] = useState<VacancyRecord[]>([])
  const [candidates, setCandidates] = useState<CandidateRecord[]>([])
  const [clientesList, setClientesList] = useState<ClienteRecord[]>([])
  const [consultasJuridicas, setConsultasJuridicas] = useState<CandidatoConsultaJuridicaRecord[]>(
    [],
  )
  const [loading, setLoading] = useState(true)

  const currentMonthStr = new Date().toISOString().slice(0, 7)
  const [monthFilter, setMonthFilter] = useState(currentMonthStr)
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [clientFilter, setClientFilter] = useState('ALL')

  // Filtros da nova seção "Custo de Consultas por Vaga"
  const [custoMonthFilter, setCustoMonthFilter] = useState(currentMonthStr)
  const [custoPeriodStart, setCustoPeriodStart] = useState('')
  const [custoPeriodEnd, setCustoPeriodEnd] = useState('')

  const loadData = async () => {
    try {
      const [vData, cData, clData, cjData] = await Promise.all([
        getVacancies(),
        getCandidates(),
        getClientes(),
        getCandidatoConsultasJuridicas(),
      ])
      setVacancies(vData)
      setCandidates(cData)
      setClientesList(clData)
      setConsultasJuridicas(cjData)
    } catch {
      toast.error('Erro ao carregar dados do relatório')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('vacancies', () => loadData())
  useRealtime('candidates', () => loadData())
  useRealtime('candidato_consultas_juridicas', () => loadData())

  const dateRange = useMemo(() => {
    if (periodStart && periodEnd) {
      return {
        start: new Date(periodStart + 'T00:00:00'),
        end: new Date(periodEnd + 'T23:59:59'),
      }
    }
    const [y, m] = monthFilter.split('-').map(Number)
    return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0, 23, 59, 59) }
  }, [monthFilter, periodStart, periodEnd])

  const filteredVacancies = useMemo(() => {
    return vacancies.filter((v) => {
      const d = new Date(v.data_abertura || v.created)
      if (d < dateRange.start || d > dateRange.end) return false
      if (clientFilter !== 'ALL' && v.cliente !== clientFilter) return false
      return true
    })
  }, [vacancies, dateRange, clientFilter])

  const reportRows = useMemo<ReportRow[]>(() => {
    const vIds = new Set(filteredVacancies.map((v) => v.id))
    const vCandidates = candidates.filter((c) => vIds.has(c.vacancy_id))
    const rows: ReportRow[] = []
    filteredVacancies.forEach((v) => {
      const cands = vCandidates.filter((c) => c.vacancy_id === v.id)
      if (cands.length === 0) {
        rows.push({
          cliente: v.expand?.cliente?.nome || '—',
          cargo: v.expand?.cargo?.nome || '—',
          statusVaga: v.status_vaga,
          prioridade: v.prioridade,
          candidato: '—',
          statusCandidato: '—',
          ranking: '—',
          custoTotal: formatCurrency(v.despesas_vaga || 0),
          tipoContrato: v.expand?.tipo_contrato?.nome || '—',
          tipoVaga: v.expand?.tipo_vaga?.nome || '—',
          rankValue: null,
        })
      } else {
        cands.forEach((c) => {
          const total =
            (c.custo_consultas || 0) +
            (c.custo_exames || 0) +
            (c.custo_testes || 0) +
            (c.custo_extras || 0)
          rows.push({
            cliente: v.expand?.cliente?.nome || '—',
            cargo: v.expand?.cargo?.nome || '—',
            statusVaga: v.status_vaga,
            prioridade: v.prioridade,
            candidato: c.nome,
            statusCandidato: c.status_candidato,
            ranking: c.rank != null ? `${c.rank}/5` : '—',
            custoTotal: formatCurrency(total),
            tipoContrato: c.expand?.tipo_contrato?.nome || '—',
            tipoVaga: c.expand?.tipo_vaga?.nome || '—',
            rankValue: c.rank ?? null,
          })
        })
      }
    })
    return rows
  }, [filteredVacancies, candidates])

  // Período para o relatório de Custo de Consultas por Vaga
  const custoDateRange = useMemo(() => {
    if (custoPeriodStart && custoPeriodEnd) {
      return {
        start: new Date(custoPeriodStart + 'T00:00:00'),
        end: new Date(custoPeriodEnd + 'T23:59:59'),
      }
    }
    const [y, m] = custoMonthFilter.split('-').map(Number)
    return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0, 23, 59, 59) }
  }, [custoMonthFilter, custoPeriodStart, custoPeriodEnd])

  // Mapas de consultas por candidato para determinar a data de consulta no período
  const candidateConsultasDatesMap = useMemo(() => {
    const map = new Map<string, Date[]>()
    consultasJuridicas.forEach((cj) => {
      if (!cj.candidato_id) return
      const rawDate = cj.consultado_em || cj.created
      if (!rawDate) return
      const d = new Date(rawDate)
      const list = map.get(cj.candidato_id) || []
      list.push(d)
      map.set(cj.candidato_id, list)
    })
    return map
  }, [consultasJuridicas])

  // Itens agregados de "Custo de Consultas por Vaga"
  const custoConsultasPorVaga = useMemo<CustoConsultasVagaItem[]>(() => {
    const { start, end } = custoDateRange

    // Filtrar candidatos enquadrados no período
    const eligibleCandidates = candidates.filter((c) => {
      if (!c.vacancy_id) return false

      const dates = candidateConsultasDatesMap.get(c.id)
      if (dates && dates.length > 0) {
        // Enquadra se tiver pelo menos uma consulta jurídica dentro do período
        return dates.some((d) => d >= start && d <= end)
      }

      // Fallback: se tem custo_consultas mas não possui consulta jurídica no período (ou sem consultas registradas),
      // usa a data de criação do candidato (candidates.created)
      if ((c.custo_consultas || 0) > 0 && c.created) {
        const dCreated = new Date(c.created)
        return dCreated >= start && dCreated <= end
      }

      return false
    })

    // Agrupar por vaga
    const vacancyMap = new Map<
      string,
      {
        vaga: VacancyRecord | undefined
        candidateIds: Set<string>
        custoTotal: number
      }
    >()

    const vacanciesById = new Map<string, VacancyRecord>()
    vacancies.forEach((v) => vacanciesById.set(v.id, v))

    eligibleCandidates.forEach((c) => {
      const vId = c.vacancy_id
      const current = vacancyMap.get(vId) || {
        vaga: vacanciesById.get(vId),
        candidateIds: new Set<string>(),
        custoTotal: 0,
      }
      current.candidateIds.add(c.id)
      current.custoTotal += Number(c.custo_consultas || 0)
      vacancyMap.set(vId, current)
    })

    const items: CustoConsultasVagaItem[] = []
    vacancyMap.forEach((entry, vId) => {
      const v = entry.vaga
      const clienteNome = v?.expand?.cliente?.nome || '—'
      const cargoNome = v?.expand?.cargo?.nome || '—'
      const vagaTitulo = cargoNome !== '—' ? `${cargoNome} (${clienteNome})` : vId

      items.push({
        vagaId: vId,
        vagaTitulo,
        clienteNome,
        cargoNome,
        totalCandidatos: entry.candidateIds.size,
        custoTotalConsultas: entry.custoTotal,
      })
    })

    // Ordenar por custo total decrescente
    return items.sort((a, b) => b.custoTotalConsultas - a.custoTotalConsultas)
  }, [candidates, vacancies, custoDateRange, candidateConsultasDatesMap])

  // Total acumulado de custos das consultas no período
  const totalGeralConsultasPeriodo = useMemo(() => {
    return custoConsultasPorVaga.reduce((acc, item) => acc + item.custoTotalConsultas, 0)
  }, [custoConsultasPorVaga])

  const totalCandidatosConsultasPeriodo = useMemo(() => {
    return custoConsultasPorVaga.reduce((acc, item) => acc + item.totalCandidatos, 0)
  }, [custoConsultasPorVaga])

  const handleExportCustoConsultas = () => {
    if (custoConsultasPorVaga.length === 0) {
      toast.error('Não há dados de custo de consultas para exportar.')
      return
    }
    const headers = [
      'Cliente',
      'Cargo',
      'Vaga',
      'Quantidade de Candidatos',
      'Custo Total de Consultas',
    ]
    const rows = custoConsultasPorVaga.map((item) => [
      item.clienteNome,
      item.cargoNome,
      item.vagaTitulo,
      item.totalCandidatos.toString(),
      formatCurrency(item.custoTotalConsultas),
    ])
    exportToCsv(
      `relatorio-custo-consultas-vaga-${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows,
    )
    toast.success('Relatório de custos exportado com sucesso!')
  }

  const handleExport = () => {
    if (reportRows.length === 0) {
      toast.error('Não há dados para exportar.')
      return
    }
    const headers = [
      'Cliente',
      'Cargo',
      'Status da Vaga',
      'Prioridade',
      'Candidato',
      'Status do Candidato',
      'Ranking',
      'Custo Total',
      'Tipo de Vaga',
      'Tipo de Contrato',
    ]
    const rows = reportRows.map((r) => [
      r.cliente,
      r.cargo,
      r.statusVaga,
      r.prioridade,
      r.candidato,
      r.statusCandidato,
      r.ranking,
      r.custoTotal,
      r.tipoVaga,
      r.tipoContrato,
    ])
    exportToCsv(`relatorio-rh-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows)
    toast.success('Relatório exportado com sucesso!')
  }

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
          <h2 className="text-xl font-bold text-slate-900">Relatórios</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Exporte e analise dados de vagas e candidatos por período e cliente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleExport}
            disabled={reportRows.length === 0}
            className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm disabled:opacity-50"
          >
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
          <Button
            onClick={() => window.print()}
            disabled={reportRows.length === 0}
            variant="outline"
            className="border-slate-200 disabled:opacity-50"
          >
            <FileDown className="h-4 w-4 mr-2" /> Exportar em PDF
          </Button>
        </div>
      </div>

      <Card className="border-slate-200 shadow-2xs print:hidden">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
            <Filter className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              Filtros de Período e Cliente
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

      <Card className="border-slate-200 shadow-2xs print:hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <FileText className="h-5 w-5 text-indigo-600" />
            <span>Relatório de Vagas e Candidatos ({reportRows.length} registros)</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Dados filtrados por período e cliente selecionados
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-xs font-semibold text-slate-600">Cliente</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Cargo</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">
                    Status da Vaga
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Prioridade</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Candidato</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">
                    Status Candidato
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Ranking</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">
                    Custo Total
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-500 text-sm">
                      Nenhum dado encontrado para os filtros aplicados.
                    </TableCell>
                  </TableRow>
                ) : (
                  reportRows.map((row, i) => (
                    <TableRow key={i} className="hover:bg-slate-50/80">
                      <TableCell className="text-xs text-slate-700 font-medium">
                        {row.cliente}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700 font-medium">
                        {row.cargo}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getVacancyStatusBadgeClass(row.statusVaga as any)}
                        >
                          {row.statusVaga}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">{row.prioridade}</TableCell>
                      <TableCell className="text-xs text-slate-900 font-bold">
                        {row.candidato}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getCandidateStatusBadgeClass(row.statusCandidato as any)}
                        >
                          {row.statusCandidato}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">{row.ranking}</TableCell>
                      <TableCell className="text-xs text-slate-900 font-semibold">
                        {row.custoTotal}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="hidden print:block space-y-4">
        <div className="border-b-2 border-slate-900 pb-3">
          <h1 className="text-xl font-bold text-slate-900">Relatório de Vagas e Candidatos</h1>
          <p className="text-[10pt] text-slate-600 mt-1">
            {getFilterSummary(monthFilter, periodStart, periodEnd, clientFilter, clientesList)}
          </p>
          <p className="text-[10pt] text-slate-600">Total de registros: {reportRows.length}</p>
        </div>
        <table className="w-full text-[10pt] border-collapse">
          <thead>
            <tr className="border-b border-slate-400">
              <th className="text-left py-1.5 px-2 font-semibold">Nome do Candidato</th>
              <th className="text-left py-1.5 px-2 font-semibold">Vaga</th>
              <th className="text-left py-1.5 px-2 font-semibold">Cliente</th>
              <th className="text-left py-1.5 px-2 font-semibold">Cargo</th>
              <th className="text-left py-1.5 px-2 font-semibold">Tipo de Vaga</th>
              <th className="text-left py-1.5 px-2 font-semibold">Tipo de Contrato</th>
              <th className="text-center py-1.5 px-2 font-semibold">Ranking</th>
              <th className="text-left py-1.5 px-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {reportRows.map((row, i) => (
              <tr key={i} className="border-b border-slate-200">
                <td className="py-1 px-2">{row.candidato}</td>
                <td className="py-1 px-2">{row.statusVaga}</td>
                <td className="py-1 px-2">{row.cliente}</td>
                <td className="py-1 px-2">{row.cargo}</td>
                <td className="py-1 px-2">{row.tipoVaga}</td>
                <td className="py-1 px-2">{row.tipoContrato}</td>
                <td className="py-1 px-2 text-center">{renderStarsAsText(row.rankValue)}</td>
                <td className="py-1 px-2">{row.statusCandidato}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ========================================================
          SEÇÃO ADITIVA: Custo de Consultas por Vaga
          ======================================================== */}
      <Card className="border-slate-200 shadow-2xs print:hidden">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Filtro de Período — Custo de Consultas por Vaga
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleExportCustoConsultas}
                disabled={custoConsultasPorVaga.length === 0}
                size="sm"
                variant="outline"
                className="h-8 text-xs border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" /> Exportar CSV
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-slate-500 font-semibold">Mês</Label>
              <Input
                type="month"
                value={custoMonthFilter}
                onChange={(e) => setCustoMonthFilter(e.target.value)}
                className="h-9 text-xs"
                disabled={!!(custoPeriodStart && custoPeriodEnd)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-slate-500 font-semibold">Período - Início</Label>
              <Input
                type="date"
                value={custoPeriodStart}
                onChange={(e) => setCustoPeriodStart(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-slate-500 font-semibold">Período - Fim</Label>
              <Input
                type="date"
                value={custoPeriodEnd}
                onChange={(e) => setCustoPeriodEnd(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>
          {(custoPeriodStart || custoPeriodEnd) && (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCustoPeriodStart('')
                  setCustoPeriodEnd('')
                }}
                className="text-xs text-rose-600 hover:text-rose-700 h-7"
              >
                <XCircle className="h-3.5 w-3.5 mr-1" /> Limpar Período
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-2xs print:hidden">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <DollarSign className="h-5 w-5 text-emerald-600" />
                <span>Custo de Consultas por Vaga ({custoConsultasPorVaga.length} vagas)</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Total acumulado de custos de consultas jurídicas dos candidatos agrupado por vaga no
                período selecionado
              </CardDescription>
            </div>
            {custoConsultasPorVaga.length > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-slate-50 text-slate-700 text-xs py-1 px-2.5">
                  Total de Candidatos:{' '}
                  <strong className="ml-1 text-slate-900">{totalCandidatosConsultasPeriodo}</strong>
                </Badge>
                <Badge
                  variant="outline"
                  className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs py-1 px-2.5"
                >
                  Custo Total:{' '}
                  <strong className="ml-1 text-emerald-800">
                    {formatCurrency(totalGeralConsultasPeriodo)}
                  </strong>
                </Badge>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-xs font-semibold text-slate-600">Cliente</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Cargo</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Vaga</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 text-center">
                    Quantidade de Candidatos
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 text-right">
                    Custo Total de Consultas
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {custoConsultasPorVaga.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500 text-sm">
                      Nenhum custo de consulta jurídica encontrado para o período selecionado.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {custoConsultasPorVaga.map((item) => (
                      <TableRow key={item.vagaId} className="hover:bg-slate-50/80">
                        <TableCell className="text-xs text-slate-700 font-medium">
                          {item.clienteNome}
                        </TableCell>
                        <TableCell className="text-xs text-slate-700 font-medium">
                          {item.cargoNome}
                        </TableCell>
                        <TableCell className="text-xs text-slate-900 font-semibold">
                          {item.vagaTitulo}
                        </TableCell>
                        <TableCell className="text-xs text-slate-800 text-center font-semibold">
                          {item.totalCandidatos}
                        </TableCell>
                        <TableCell className="text-xs text-emerald-700 font-bold text-right">
                          {formatCurrency(item.custoTotalConsultas)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-slate-50/90 font-bold border-t-2 border-slate-200">
                      <TableCell colSpan={3} className="text-xs text-slate-900">
                        Total Geral ({custoConsultasPorVaga.length} vagas)
                      </TableCell>
                      <TableCell className="text-xs text-slate-900 text-center">
                        {totalCandidatosConsultasPeriodo}
                      </TableCell>
                      <TableCell className="text-xs text-emerald-700 text-right">
                        {formatCurrency(totalGeralConsultasPeriodo)}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="hidden print:block space-y-4 pt-6 mt-6 border-t-2 border-slate-900">
        <div className="pb-3 border-b border-slate-400">
          <h2 className="text-xl font-bold text-slate-900">Custo de Consultas por Vaga</h2>
          <p className="text-[10pt] text-slate-600 mt-1">
            Período:{' '}
            {custoPeriodStart && custoPeriodEnd
              ? `${custoPeriodStart} a ${custoPeriodEnd}`
              : custoMonthFilter}{' '}
            | Vagas: {custoConsultasPorVaga.length} | Custo Total:{' '}
            {formatCurrency(totalGeralConsultasPeriodo)}
          </p>
        </div>
        <table className="w-full text-[10pt] border-collapse">
          <thead>
            <tr className="border-b border-slate-400">
              <th className="text-left py-1.5 px-2 font-semibold">Cliente</th>
              <th className="text-left py-1.5 px-2 font-semibold">Cargo</th>
              <th className="text-left py-1.5 px-2 font-semibold">Vaga</th>
              <th className="text-center py-1.5 px-2 font-semibold">Qtd. Candidatos</th>
              <th className="text-right py-1.5 px-2 font-semibold">Custo Total de Consultas</th>
            </tr>
          </thead>
          <tbody>
            {custoConsultasPorVaga.map((item) => (
              <tr key={item.vagaId} className="border-b border-slate-200">
                <td className="py-1 px-2">{item.clienteNome}</td>
                <td className="py-1 px-2">{item.cargoNome}</td>
                <td className="py-1 px-2">{item.vagaTitulo}</td>
                <td className="py-1 px-2 text-center">{item.totalCandidatos}</td>
                <td className="py-1 px-2 text-right font-semibold">
                  {formatCurrency(item.custoTotalConsultas)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
