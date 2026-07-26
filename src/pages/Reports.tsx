import { useState, useEffect, useMemo } from 'react'
import { getVacancies } from '@/services/vacancies'
import { getCandidates } from '@/services/candidates'
import { getClientes } from '@/services/clientes'
import { VacancyRecord, CandidateRecord, ClienteRecord } from '@/types'
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
import { Filter, Download, FileText, XCircle } from 'lucide-react'
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
}

export default function Reports() {
  const [vacancies, setVacancies] = useState<VacancyRecord[]>([])
  const [candidates, setCandidates] = useState<CandidateRecord[]>([])
  const [clientesList, setClientesList] = useState<ClienteRecord[]>([])
  const [loading, setLoading] = useState(true)

  const currentMonthStr = new Date().toISOString().slice(0, 7)
  const [monthFilter, setMonthFilter] = useState(currentMonthStr)
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
          custoTotal: formatCurrency(0),
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
          })
        })
      }
    })
    return rows
  }, [filteredVacancies, candidates])

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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Relatórios</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Exporte e analise dados de vagas e candidatos por período e cliente.
          </p>
        </div>
        <Button
          onClick={handleExport}
          disabled={reportRows.length === 0}
          className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm disabled:opacity-50"
        >
          <Download className="h-4 w-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      <Card className="border-slate-200 shadow-2xs">
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

      <Card className="border-slate-200 shadow-2xs">
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
    </div>
  )
}
