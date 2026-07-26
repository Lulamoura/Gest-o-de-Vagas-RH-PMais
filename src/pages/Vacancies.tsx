import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getVacancies, updateVacancy } from '@/services/vacancies'
import { createPipelineHistory } from '@/services/pipeline_history'
import { VacancyRecord, VacancyStatus, VacancyPriority, VacancyType } from '@/types'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import {
  calculateDaysOpen,
  formatDateBR,
  getVacancyStatusBadgeClass,
  getPriorityBadgeClass,
  VACANCY_PIPELINE_STAGES,
} from '@/lib/status-utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  PlusCircle,
  Search,
  Eye,
  Pencil,
  ChevronRight,
  Filter,
  Building2,
  Calendar,
  User,
  XCircle,
} from 'lucide-react'

export default function Vacancies() {
  const [vacancies, setVacancies] = useState<VacancyRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [clientFilter, setClientFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [priorityFilter, setPriorityFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')

  // Quick move pipeline dialog state
  const [selectedVacancy, setSelectedVacancy] = useState<VacancyRecord | null>(null)
  const [newStatus, setNewStatus] = useState<VacancyStatus | ''>('')
  const [moving, setMoving] = useState(false)

  const { user } = useAuth()

  const loadData = async () => {
    try {
      const data = await getVacancies()
      setVacancies(data)
    } catch (err) {
      toast.error('Erro ao carregar lista de vagas')
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

  const uniqueClients = useMemo(() => {
    const map = new Map<string, string>()
    vacancies.forEach((v) => {
      if (v.cliente) {
        map.set(v.cliente, v.expand?.cliente?.nome || v.cliente)
      }
    })
    return Array.from(map, ([id, name]) => ({ id, name }))
  }, [vacancies])

  const uniqueTypes = useMemo(() => {
    const map = new Map<string, string>()
    vacancies.forEach((v) => {
      if (v.tipo_vaga) {
        map.set(v.tipo_vaga, v.expand?.tipo_vaga?.nome || v.tipo_vaga)
      }
    })
    return Array.from(map, ([id, name]) => ({ id, name }))
  }, [vacancies])

  const filteredVacancies = useMemo(() => {
    return vacancies.filter((v) => {
      const cargoNome = v.expand?.cargo?.nome || ''
      const clienteNome = v.expand?.cliente?.nome || ''
      const cidadeNome = v.expand?.cidade?.nome || ''
      const matchesSearch =
        search === '' ||
        cargoNome.toLowerCase().includes(search.toLowerCase()) ||
        clienteNome.toLowerCase().includes(search.toLowerCase()) ||
        cidadeNome.toLowerCase().includes(search.toLowerCase())

      const matchesClient = clientFilter === 'ALL' || v.cliente === clientFilter
      const matchesStatus = statusFilter === 'ALL' || v.status_vaga === statusFilter
      const matchesPriority = priorityFilter === 'ALL' || v.prioridade === priorityFilter
      const matchesType = typeFilter === 'ALL' || v.tipo_vaga === typeFilter

      return matchesSearch && matchesClient && matchesStatus && matchesPriority && matchesType
    })
  }, [vacancies, search, clientFilter, statusFilter, priorityFilter, typeFilter])

  const handleMovePipeline = async () => {
    if (!selectedVacancy || !newStatus) return
    setMoving(true)

    try {
      await updateVacancy(selectedVacancy.id, {
        status_vaga: newStatus,
        data_fechamento:
          newStatus === 'Fechada' ? new Date().toISOString() : selectedVacancy.data_fechamento,
        data_cancelamento:
          newStatus === 'Cancelada' ? new Date().toISOString() : selectedVacancy.data_cancelamento,
      })

      await createPipelineHistory({
        vacancy_id: selectedVacancy.id,
        usuario_id: user?.id,
        status_anterior: selectedVacancy.status_vaga,
        status_novo: newStatus,
      })

      toast.success(`Vaga movida para a etapa "${newStatus}" com sucesso!`)
      setSelectedVacancy(null)
      loadData()
    } catch (err) {
      toast.error('Falha ao mover vaga no pipeline')
    } finally {
      setMoving(false)
    }
  }

  const clearFilters = () => {
    setSearch('')
    setClientFilter('ALL')
    setStatusFilter('ALL')
    setPriorityFilter('ALL')
    setTypeFilter('ALL')
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
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Gestão de Vagas</h2>
          <p className="text-xs text-slate-500">
            Cadastre, acompanhe e controle o fluxo de todos os processos seletivos
          </p>
        </div>

        <Button asChild className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm">
          <Link to="/vagas/nova">
            <PlusCircle className="h-4 w-4 mr-2" /> Nova Vaga
          </Link>
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="border-slate-200 shadow-2xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
            <Filter className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              Filtros Avançados
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por cargo ou cidade..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Cliente */}
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

            {/* Status */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os Status</SelectItem>
                {VACANCY_PIPELINE_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Prioridade */}
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

            {/* Tipo */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Tipo de Vaga" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os Tipos</SelectItem>
                {uniqueTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(search ||
            clientFilter !== 'ALL' ||
            statusFilter !== 'ALL' ||
            priorityFilter !== 'ALL' ||
            typeFilter !== 'ALL') && (
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

      {/* Desktop Table View */}
      <Card className="border-slate-200 shadow-2xs hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-xs font-semibold text-slate-600">
                  Cargo / Cliente
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Status</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">
                  Responsável RH
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Abertura</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Dias Abertos</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">
                  Prazo Desejado
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Prioridade</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 text-right">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVacancies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-500 text-sm">
                    Nenhuma vaga encontrada com os filtros aplicados.
                  </TableCell>
                </TableRow>
              ) : (
                filteredVacancies.map((vaga) => {
                  const diasAbertos = calculateDaysOpen(vaga.data_abertura, vaga.data_fechamento)
                  return (
                    <TableRow key={vaga.id} className="hover:bg-slate-50/80 transition-colors">
                      <TableCell>
                        <div className="font-bold text-slate-900 text-sm">
                          {vaga.expand?.cargo?.nome || '—'}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center space-x-1 mt-0.5">
                          <Building2 className="h-3 w-3" />
                          <span>{vaga.expand?.cliente?.nome || '—'}</span>
                          {vaga.expand?.cidade?.nome && (
                            <span className="text-slate-400">• {vaga.expand?.cidade?.nome}</span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getVacancyStatusBadgeClass(vaga.status_vaga)}
                        >
                          {vaga.status_vaga}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-xs text-slate-700">
                        <div className="flex items-center space-x-1">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          <span>{vaga.expand?.responsavel_rh?.name || 'Não atribuído'}</span>
                        </div>
                      </TableCell>

                      <TableCell className="text-xs text-slate-600">
                        {formatDateBR(vaga.data_abertura)}
                      </TableCell>

                      <TableCell>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded ${
                            diasAbertos > 30
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {diasAbertos} dias
                        </span>
                      </TableCell>

                      <TableCell className="text-xs text-slate-600">
                        {formatDateBR(vaga.prazo_desejado)}
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline" className={getPriorityBadgeClass(vaga.prioridade)}>
                          {vaga.prioridade}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <Button
                            asChild
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-600 hover:text-indigo-600"
                            title="Visualizar"
                          >
                            <Link to={`/vagas/${vaga.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            asChild
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-600 hover:text-amber-600"
                            title="Editar"
                          >
                            <Link to={`/vagas/${vaga.id}/editar`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedVacancy(vaga)
                              setNewStatus(vaga.status_vaga)
                            }}
                            className="h-8 w-8 text-slate-600 hover:text-emerald-600"
                            title="Mover Pipeline"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Mobile Card List View */}
      <div className="md:hidden space-y-3">
        {filteredVacancies.map((vaga) => (
          <Card key={vaga.id} className="border-slate-200 shadow-2xs">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {vaga.expand?.cargo?.nome || '—'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {vaga.expand?.cliente?.nome || '—'}
                  </p>{' '}
                </div>
                <Badge variant="outline" className={getVacancyStatusBadgeClass(vaga.status_vaga)}>
                  {vaga.status_vaga}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Prioridade
                  </span>
                  <Badge
                    variant="outline"
                    className={
                      getPriorityBadgeClass(vaga.prioridade) + ' text-[10px] px-1.5 mt-0.5'
                    }
                  >
                    {vaga.prioridade}
                  </Badge>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Dias Abertos
                  </span>
                  <span className="font-semibold text-slate-800">
                    {calculateDaysOpen(vaga.data_abertura)} dias
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <Button asChild variant="outline" size="sm" className="w-full text-xs">
                  <Link to={`/vagas/${vaga.id}`}>Ver Detalhes da Vaga</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Move Pipeline Modal */}
      <Dialog open={!!selectedVacancy} onOpenChange={(open) => !open && setSelectedVacancy(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mover Pipeline de Vaga</DialogTitle>
            <DialogDescription>
              Altere a etapa atual da vaga{' '}
              <strong className="text-slate-900">
                {selectedVacancy?.expand?.cargo?.nome || '—'}
              </strong>{' '}
              ({selectedVacancy?.expand?.cliente?.nome || '—'})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Etapa Atual
              </label>
              <Badge
                variant="outline"
                className={
                  selectedVacancy ? getVacancyStatusBadgeClass(selectedVacancy.status_vaga) : ''
                }
              >
                {selectedVacancy?.status_vaga}
              </Badge>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Nova Etapa do Pipeline
              </label>
              <Select value={newStatus} onValueChange={(val) => setNewStatus(val as VacancyStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o novo status" />
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedVacancy(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleMovePipeline}
              disabled={moving || !newStatus || newStatus === selectedVacancy?.status_vaga}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              {moving ? 'Salvando...' : 'Confirmar Mudança'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
