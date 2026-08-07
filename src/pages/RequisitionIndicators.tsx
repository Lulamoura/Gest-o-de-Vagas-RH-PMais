import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useRealtime } from '@/hooks/use-realtime'
import { getRequisitions } from '@/services/requisitions'
import pb from '@/lib/pocketbase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { ArrowLeft, Clock, CheckCircle2, XCircle, ClipboardList, TrendingUp } from 'lucide-react'
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
import type { RequisitionRecord, RequisitionHistoryRecord } from '@/types'

const PIE_COLORS = [
  '#3b82f6',
  '#a855f7',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#94a3b8',
  '#06b6d4',
  '#ec4899',
]
const STATUS_LABELS: Record<string, string> = {
  Rascunho: 'Rascunho',
  'Aguardando aprovação': 'Aguardando',
  'Em análise': 'Em Análise',
  Aprovada: 'Aprovada',
  Reprovada: 'Reprovada',
  Cancelada: 'Cancelada',
  'Rascunho criado no WordPress': 'Rascunho WP',
  Publicada: 'Publicada',
}

export default function RequisitionIndicators() {
  const [requisitions, setRequisitions] = useState<RequisitionRecord[]>([])
  const [history, setHistory] = useState<RequisitionHistoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [fDept, setFDept] = useState('all')

  const loadData = async () => {
    try {
      const [reqs, hist] = await Promise.all([
        getRequisitions(),
        pb.collection('requisition_history').getFullList({
          filter: "status_novo = 'Aprovada'",
        }),
      ])
      setRequisitions(reqs)
      setHistory(hist as unknown as RequisitionHistoryRecord[])
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('requisitions', () => loadData())
  useRealtime('requisition_history', () => loadData())

  const filtered = useMemo(() => {
    return requisitions.filter((r) => {
      if (fDept !== 'all' && (r.expand?.departamento?.nome || '').toLowerCase() !== fDept)
        return false
      if (dateFrom && new Date(r.created) < new Date(dateFrom + 'T00:00:00')) return false
      if (dateTo && new Date(r.created) > new Date(dateTo + 'T23:59:59')) return false
      return true
    })
  }, [requisitions, fDept, dateFrom, dateTo])

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {}
    filtered.forEach((r) => {
      counts[r.status] = (counts[r.status] || 0) + 1
    })
    return Object.entries(counts).map(([name, value]) => ({
      name: STATUS_LABELS[name] || name,
      value,
    }))
  }, [filtered])

  const deptData = useMemo(() => {
    const counts: Record<string, number> = {}
    filtered.forEach((r) => {
      const d = r.expand?.departamento?.nome || 'Sem departamento'
      counts[d] = (counts[d] || 0) + 1
    })
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
    }))
  }, [filtered])

  const clientData = useMemo(() => {
    const counts: Record<string, number> = {}
    filtered.forEach((r) => {
      const c = r.expand?.cliente?.nome || 'N/A'
      counts[c] = (counts[c] || 0) + 1
    })
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [filtered])

  const cargoData = useMemo(() => {
    const counts: Record<string, number> = {}
    filtered.forEach((r) => {
      const c = r.expand?.cargo?.nome || 'N/A'
      counts[c] = (counts[c] || 0) + 1
    })
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [filtered])

  const monthlyData = useMemo(() => {
    const counts: Record<string, number> = {}
    filtered.forEach((r) => {
      const m = (r.created || '').slice(0, 7)
      if (m) counts[m] = (counts[m] || 0) + 1
    })
    return Object.entries(counts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, value]) => ({ name, value }))
  }, [filtered])

  const APPROVED_STATUSES = ['Aprovada', 'Rascunho criado no WordPress', 'Publicada']
  const avgApprovalDays = useMemo(() => {
  const approved = filtered.filter((r) => APPROVED_STATUSES.includes(r.status))
  if (approved.length === 0) return 0    let total = 0
    let count = 0
    for (const r of approved) {
      const hist = history.find((h) => h.requisition_id === r.id)
      if (hist?.data_mudanca && r.created) {
        const diff = new Date(hist.data_mudanca).getTime() - new Date(r.created).getTime()
        total += Math.max(0, Math.floor(diff / 86400000))
        count++
      }
    }
    return count > 0 ? Math.round(total / count) : 0
  }, [filtered, history])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    )
  }

  const kpis = [
    {
      label: 'Total',
      value: filtered.length,
      icon: ClipboardList,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Aguardando',
      value: filtered.filter((r) => r.status === 'Aguardando aprovação').length,
      icon: Clock,
      color: 'text-amber-600 bg-amber-50',
    },
    {
      label: 'Aprovadas',
      value: filtered.filter((r) => r.status === 'Aprovada').length,
      icon: CheckCircle2,
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      label: 'Reprovadas',
      value: filtered.filter((r) => r.status === 'Reprovada').length,
      icon: XCircle,
      color: 'text-rose-600 bg-rose-50',
    },
    {
      label: 'Tempo Médio Aprovação',
      value: `${avgApprovalDays} dias`,
      icon: TrendingUp,
      color: 'text-purple-600 bg-purple-50',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/requisicoes">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Indicadores de Requisições</h1>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-slate-500 font-semibold">Data Início</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-slate-500 font-semibold">Data Fim</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-slate-500 font-semibold">Departamento</Label>
              <Select value={fDept} onValueChange={setFDept}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                  <SelectItem value="operacional">Operacional</SelectItem>
                  <SelectItem value="rh">RH</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon
          return (
            <Card key={k.label} className="border-slate-200 shadow-2xs">
              <CardContent className="p-4">
                <div className={`p-2 rounded-lg inline-block ${k.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-2xl font-extrabold text-slate-900 mt-2">{k.value}</p>
                <p className="text-xs text-slate-500">{k.label}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status das Requisições</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {statusData.map((_entry, i) => (
                    <Cell key={`cell-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por Departamento</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por Cliente (Top 10)</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={clientData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" stroke="#64748b" fontSize={11} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={10} width={100} />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por Cargo (Top 10)</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cargoData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" stroke="#64748b" fontSize={11} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={10} width={100} />
                <Tooltip />
                <Bar dataKey="value" fill="#a855f7" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Volume por Mês</CardTitle>
        </CardHeader>
        <CardContent className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
