import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCandidates } from '@/services/candidates'
import { CandidateRecord } from '@/types'
import { useRealtime } from '@/hooks/use-realtime'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StarRating } from '@/components/StarRating'
import { getCandidateStatusBadgeClass, formatDateBR, toDateInputValue } from '@/lib/status-utils'
import { toast } from 'sonner'
import { Eye, Calendar, Users } from 'lucide-react'

type StatusFilter = 'pending' | 'integrated' | 'all'

export default function GestaoIntegracao() {
  const navigate = useNavigate()
  const [candidates, setCandidates] = useState<CandidateRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [monthFilter, setMonthFilter] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')

  const loadData = async () => {
    try {
      const list = await getCandidates('integracao_ativa = true')
      setCandidates(list)
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

  const filteredCandidates = candidates.filter((c) => {
    if (statusFilter === 'pending' && c.status_candidato !== 'Cadastro DP') return false
    if (statusFilter === 'integrated' && c.status_candidato !== 'Integrado') return false

    const dateStr = toDateInputValue(c.data_integracao)

    if (monthFilter) {
      if (!dateStr || dateStr.substring(0, 7) !== monthFilter) return false
    }
    if (periodStart) {
      if (!dateStr || dateStr < periodStart) return false
    }
    if (periodEnd) {
      if (!dateStr || dateStr > periodEnd) return false
    }

    return true
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Gestão de Integração</h1>
        <p className="text-slate-500 text-xs mt-1">
          Acompanhe e finalize a integração de candidatos.
        </p>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Mês</Label>
              <Input
                type="month"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Período - Início</Label>
              <Input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Período - Fim</Label>
              <Input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Status de Integração</Label>
              <Select
                value={statusFilter}
                onValueChange={(val) => setStatusFilter(val as StatusFilter)}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="integrated">Integrados</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {(monthFilter || periodStart || periodEnd) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setMonthFilter('')
                setPeriodStart('')
                setPeriodEnd('')
              }}
              className="text-xs text-slate-500"
            >
              Limpar filtros de data
            </Button>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : filteredCandidates.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="p-8 text-center text-slate-500 text-sm">
            <Users className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            Nenhum candidato encontrado com os filtros selecionados.
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
                      <CardTitle className="text-base font-bold text-slate-900 line-clamp-1">
                        {c.nome}
                      </CardTitle>
                      <p className="text-xs text-slate-500 mt-0.5">
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
                  </div>

                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-indigo-600 shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                        Data da Integração
                      </p>
                      <p className="text-sm font-bold text-indigo-900">
                        {c.data_integracao ? formatDateBR(c.data_integracao) : 'Não definida'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <Badge
                      variant="outline"
                      className={getCandidateStatusBadgeClass(c.status_candidato)}
                    >
                      {c.status_candidato}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/integracao/${c.id}`)}
                      className="h-7 w-8 p-0 text-slate-500 hover:text-slate-900"
                      title="Ver Detalhes"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
