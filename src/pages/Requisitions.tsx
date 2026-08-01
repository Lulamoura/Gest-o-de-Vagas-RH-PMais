import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getRequisitions, deleteRequisition } from '@/services/requisitions'
import { getClientes } from '@/services/clientes'
import { getCargos } from '@/services/cargos'
import { RequisitionRecord, ClienteRecord, CargoRecord } from '@/types'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { formatDateBR, toDateInputValue } from '@/lib/status-utils'
import {
  DEPARTAMENTO_LABELS,
  REQUISITION_STATUS_BADGE,
  DEPARTAMENTO_OPTIONS,
} from '@/lib/requisition-utils'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { PlusCircle, Search, Eye, Pencil, Trash2, Filter, XCircle, Building2 } from 'lucide-react'

export default function Requisitions() {
  const { user, isSuperAdmin, isAdmin } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [requisitions, setRequisitions] = useState<RequisitionRecord[]>([])
  const [clientes, setClientes] = useState<ClienteRecord[]>([])
  const [cargos, setCargos] = useState<CargoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<RequisitionRecord | null>(null)
  const [deleting, setDeleting] = useState(false)
  const deletingRef = useRef(false)

  const search = searchParams.get('q') || ''
  const statusFilter = searchParams.get('status') || 'ALL'
  const departamentoFilter = searchParams.get('departamento') || 'ALL'
  const clienteFilter = searchParams.get('cliente') || 'ALL'
  const cargoFilter = searchParams.get('cargo') || 'ALL'
  const dateFrom = searchParams.get('from') || ''
  const dateTo = searchParams.get('to') || ''

  const canCreate =
    user?.profile === 'operator' || user?.profile === 'admin' || user?.profile === 'superadmin'

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value && value !== 'ALL') next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  const loadData = async () => {
    try {
      const [reqData, clData, cgData] = await Promise.all([
        getRequisitions(),
        getClientes(),
        getCargos(),
      ])
      setRequisitions(reqData)
      setClientes(clData)
      setCargos(cgData)
    } catch {
      toast.error('Erro ao carregar requisições')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('requisitions', () => {
    loadData()
  })

  const filtered = useMemo(() => {
    return requisitions.filter((r) => {
      const solicitanteNome = r.expand?.solicitante?.name || ''
      const clienteNome = r.expand?.cliente?.nome || ''
      const cargoNome = r.expand?.cargo?.nome || ''
      const matchesSearch =
        !search ||
        solicitanteNome.toLowerCase().includes(search.toLowerCase()) ||
        clienteNome.toLowerCase().includes(search.toLowerCase()) ||
        cargoNome.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter
      const matchesDepto = departamentoFilter === 'ALL' || r.departamento === departamentoFilter
      const matchesCliente = clienteFilter === 'ALL' || r.cliente === clienteFilter
      const matchesCargo = cargoFilter === 'ALL' || r.cargo === cargoFilter
      const createdDate = r.created ? new Date(r.created) : null
      const matchesFrom = !dateFrom || (createdDate && createdDate >= new Date(dateFrom))
      const matchesTo = !dateTo || (createdDate && createdDate <= new Date(dateTo + 'T23:59:59'))
      return (
        matchesSearch &&
        matchesStatus &&
        matchesDepto &&
        matchesCliente &&
        matchesCargo &&
        matchesFrom &&
        matchesTo
      )
    })
  }, [
    requisitions,
    search,
    statusFilter,
    departamentoFilter,
    clienteFilter,
    cargoFilter,
    dateFrom,
    dateTo,
  ])

  const canEdit = (r: RequisitionRecord) => {
    if (r.status !== 'Rascunho') return false
    if (isAdmin || isSuperAdmin) return true
    return r.solicitante === user?.id
  }

  const handleDelete = async () => {
    if (!deleteTarget || deletingRef.current) return
    deletingRef.current = true
    setDeleting(true)
    try {
      await deleteRequisition(deleteTarget.id)
      toast.success('Requisição excluída com sucesso!')
      setDeleteTarget(null)
      loadData()
    } catch {
      toast.error('Erro ao excluir requisição')
    } finally {
      deletingRef.current = false
      setDeleting(false)
    }
  }

  const clearFilters = () => setSearchParams({}, { replace: true })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Requisições de Vagas</h2>
          <p className="text-xs text-slate-500">Crie e acompanhe requisições de vagas internas</p>
        </div>
        {canCreate && (
          <Button asChild className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm">
            <Link to="/requisicoes/nova">
              <PlusCircle className="h-4 w-4 mr-2" /> Nova Requisição
            </Link>
          </Button>
        )}
      </div>

      <Card className="border-slate-200 shadow-2xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
            <Filter className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              Filtros
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => updateParam('q', e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => updateParam('status', v)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os Status</SelectItem>
                <SelectItem value="Rascunho">Rascunho</SelectItem>
                <SelectItem value="Aguardando aprovação">Aguardando aprovação</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={departamentoFilter}
              onValueChange={(v) => updateParam('departamento', v)}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Departamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os Departamentos</SelectItem>
                {DEPARTAMENTO_OPTIONS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={clienteFilter} onValueChange={(v) => updateParam('cliente', v)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os Clientes</SelectItem>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={cargoFilter} onValueChange={(v) => updateParam('cargo', v)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Cargo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os Cargos</SelectItem>
                {cargos.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => updateParam('from', e.target.value)}
              className="h-9 text-xs"
              placeholder="De"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => updateParam('to', e.target.value)}
              className="h-9 text-xs"
              placeholder="Até"
            />
          </div>
          {searchParams.toString() && (
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

      <Card className="border-slate-200 shadow-2xs hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-xs font-semibold text-slate-600">Solicitante</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Depto</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">
                  Cliente / Cargo
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Vagas</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Prazo</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Status</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Criado em</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 text-right">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-500 text-sm">
                    Nenhuma requisição encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <TableCell className="font-bold text-slate-900 text-sm">
                      {r.expand?.solicitante?.name || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {r.departamento ? DEPARTAMENTO_LABELS[r.departamento] : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium text-slate-800">
                        {r.expand?.cliente?.nome || '—'}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {r.expand?.cargo?.nome || '—'}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-slate-800">
                      {r.quantidade_vagas || 0}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {formatDateBR(r.prazo_desejado)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={REQUISITION_STATUS_BADGE[r.status]}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {formatDateBR(r.created)}
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
                          <Link to={`/requisicoes/${r.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        {canEdit(r) && (
                          <Button
                            asChild
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-600 hover:text-amber-600"
                            title="Editar"
                          >
                            <Link to={`/requisicoes/${r.id}/editar`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                        )}
                        {isSuperAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(r)}
                            className="h-8 w-8 text-slate-600 hover:text-rose-600"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="md:hidden space-y-3">
        {filtered.map((r) => (
          <Card key={r.id} className="border-slate-200 shadow-2xs">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {r.expand?.solicitante?.name || '—'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {r.expand?.cliente?.nome || '—'} • {r.expand?.cargo?.nome || '—'}
                  </p>
                </div>
                <Badge variant="outline" className={REQUISITION_STATUS_BADGE[r.status]}>
                  {r.status}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-600">
                <span>
                  Vagas: <strong>{r.quantidade_vagas || 0}</strong>
                </span>
                <span>
                  Depto:{' '}
                  <strong>{r.departamento ? DEPARTAMENTO_LABELS[r.departamento] : '—'}</strong>
                </span>
                <span>
                  Criado: <strong>{formatDateBR(r.created)}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <Button asChild variant="outline" size="sm" className="flex-1 text-xs">
                  <Link to={`/requisicoes/${r.id}`}>Ver</Link>
                </Button>
                {canEdit(r) && (
                  <Button asChild variant="outline" size="sm" className="flex-1 text-xs">
                    <Link to={`/requisicoes/${r.id}/editar`}>Editar</Link>
                  </Button>
                )}
                {isSuperAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteTarget(r)}
                    className="text-xs border-rose-200 text-rose-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Requisição</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-500 text-white"
            >
              {deleting ? 'Excluindo...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
