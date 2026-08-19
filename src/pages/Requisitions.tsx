import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Loader2,
  Search,
  Copy,
  Eye,
  Pencil,
  Plus,
  Layers,
  Layers3,
  BarChart2,
  Trash2,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  getPriorityBadgeClass,
  getRequisitionStatusBadgeClass,
  formatDateBR,
} from '@/lib/status-utils'
import { getRequisitions, deleteRequisition } from '@/services/requisitions'
import { getClientes } from '@/services/clientes'
import { getCargos } from '@/services/cargos'
import { getDepartamentos } from '@/services/departamentos'
import type { RequisitionRecord, ClienteRecord, CargoRecord, DepartamentoRecord } from '@/types'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { toast } from 'sonner'

const statusLabels: Record<string, string> = {
  Rascunho: 'Rascunho',
  'Aguardando aprovação': 'Aguardando Aprovação',
  'Em análise': 'Em Análise',
  Aprovada: 'Aprovada',
  Reprovada: 'Reprovada',
  Cancelada: 'Cancelada',
}

export default function Requisitions() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [requisitions, setRequisitions] = useState<RequisitionRecord[]>([])
  const [clientes, setClientes] = useState<ClienteRecord[]>([])
  const [cargos, setCargos] = useState<CargoRecord[]>([])
  const [departamentos, setDepartamentos] = useState<DepartamentoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [reqToDelete, setReqToDelete] = useState<RequisitionRecord | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')
  const [fStatus, setFStatus] = useState('all')
  const [fDepartamento, setFDepartamento] = useState('all')
  const [fCliente, setFCliente] = useState('all')
  const [fCargo, setFCargo] = useState('all')
  const [fNumeroOe, setFNumeroOe] = useState('')
  const [fDateFrom, setFDateFrom] = useState('')
  const [fDateTo, setFDateTo] = useState('')
  const [groupByOe, setGroupByOe] = useState(false)

  const canCreate = ['operator', 'admin', 'superadmin'].includes(user?.profile || '')
  const canDelete = user?.profile === 'superadmin'

  const loadData = async () => {
    try {
      const [reqs, cli, car, depts] = await Promise.all([
        getRequisitions(),
        getClientes(),
        getCargos(),
        getDepartamentos(),
      ])
      setRequisitions(reqs)
      setClientes(cli)
      setCargos(car)
      setDepartamentos(depts)
    } catch {
      /* ignore */
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
      const s = search.toLowerCase()
      if (s) {
        const matches =
          (r.numero_oe || '').toLowerCase().includes(s) ||
          (r.expand?.cliente?.nome || '').toLowerCase().includes(s) ||
          (r.expand?.cargo?.nome || '').toLowerCase().includes(s) ||
          (r.expand?.solicitante?.name || '').toLowerCase().includes(s)
        if (!matches) return false
      }
      if (fStatus !== 'all' && r.status !== fStatus) return false
      if (fDepartamento !== 'all' && r.departamento !== fDepartamento) return false
      if (fCliente !== 'all' && r.cliente !== fCliente) return false
      if (fCargo !== 'all' && r.cargo !== fCargo) return false
      if (fNumeroOe && !(r.numero_oe || '').toLowerCase().includes(fNumeroOe.toLowerCase()))
        return false
      if (fDateFrom && new Date(r.created) < new Date(fDateFrom)) return false
      if (fDateTo && new Date(r.created) > new Date(fDateTo + 'T23:59:59')) return false
      return true
    })
  }, [
    requisitions,
    search,
    fStatus,
    fDepartamento,
    fCliente,
    fCargo,
    fNumeroOe,
    fDateFrom,
    fDateTo,
  ])

  const grouped = useMemo(() => {
    if (!groupByOe) return null
    const map = new Map<string, RequisitionRecord[]>()
    for (const r of filtered) {
      const key = r.numero_oe || 'Sem OE'
      const arr = map.get(key) || []
      arr.push(r)
      map.set(key, arr)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered, groupByOe])

  const canEdit = (r: RequisitionRecord) =>
    r.status === 'Rascunho' &&
    (user?.id === r.solicitante || ['admin', 'superadmin'].includes(user?.profile || ''))

  const handleConfirmDelete = async () => {
    if (!reqToDelete) return
    setDeleting(true)
    try {
      await deleteRequisition(reqToDelete.id)
      toast.success('Requisição excluída com sucesso!')
      setDeleteDialogOpen(false)
      setReqToDelete(null)
      loadData()
    } catch {
      toast.error('Erro ao excluir requisição')
    } finally {
      setDeleting(false)
    }
  }

  const renderRow = (r: RequisitionRecord) => (
    <TableRow key={r.id}>
      <TableCell className="font-medium">{r.numero_oe || '-'}</TableCell>
      <TableCell>
        <Badge className={getRequisitionStatusBadgeClass(r.status)}>
          {statusLabels[r.status] || r.status}
        </Badge>
      </TableCell>
      <TableCell>{r.expand?.departamento?.nome || '-'}</TableCell>
      <TableCell>{r.expand?.cliente?.nome || '-'}</TableCell>
      <TableCell>{r.expand?.cargo?.nome || '-'}</TableCell>
      <TableCell className="text-center">{r.quantidade_vagas || 0}</TableCell>
      <TableCell>
        <Badge className={getPriorityBadgeClass(r.prioridade || '')}>{r.prioridade || '-'}</Badge>
      </TableCell>
      <TableCell>{r.prazo_desejado ? formatDateBR(r.prazo_desejado) : '-'}</TableCell>
      <TableCell>{r.expand?.solicitante?.name || '-'}</TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/requisicoes/${r.id}`)}
            title="Visualizar"
          >
            <Eye className="h-4 w-4" />
          </Button>
          {canEdit(r) && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/requisicoes/${r.id}/editar`)}
              title="Editar"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {canCreate && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/requisicoes/nova?duplicate=${r.id}`)}
              title="Duplicar"
            >
              <Copy className="h-4 w-4" />
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setReqToDelete(r)
                setDeleteDialogOpen(true)
              }}
              title="Excluir"
              className="text-slate-600 hover:text-rose-600"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Requisições de Vagas</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/requisicoes/indicadores')}>
            <BarChart2 className="h-4 w-4 mr-2" /> Indicadores
          </Button>
          {canCreate && (
            <Button onClick={() => navigate('/requisicoes/nova')}>
              <Plus className="h-4 w-4 mr-2" /> Nova Requisição
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por OE, cliente, cargo, solicitante..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="Rascunho">Rascunho</SelectItem>
                <SelectItem value="Aguardando aprovação">Aguardando Aprovação</SelectItem>
                <SelectItem value="Em análise">Em Análise</SelectItem>
                <SelectItem value="Aprovada">Aprovada</SelectItem>
                <SelectItem value="Reprovada">Reprovada</SelectItem>
                <SelectItem value="Cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fDepartamento} onValueChange={setFDepartamento}>
              <SelectTrigger>
                <SelectValue placeholder="Depto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os deptos</SelectItem>
                {departamentos.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fCliente} onValueChange={setFCliente}>
              <SelectTrigger>
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fCargo} onValueChange={setFCargo}>
              <SelectTrigger>
                <SelectValue placeholder="Cargo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os cargos</SelectItem>
                {cargos.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Número da OE"
              value={fNumeroOe}
              onChange={(e) => setFNumeroOe(e.target.value)}
            />
            <Input type="date" value={fDateFrom} onChange={(e) => setFDateFrom(e.target.value)} />
            <Input type="date" value={fDateTo} onChange={(e) => setFDateTo(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={groupByOe ? 'default' : 'outline'}
              size="sm"
              onClick={() => setGroupByOe(!groupByOe)}
            >
              {groupByOe ? (
                <Layers3 className="h-4 w-4 mr-1" />
              ) : (
                <Layers className="h-4 w-4 mr-1" />
              )}
              Agrupar por Número da OE
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma requisição encontrada</p>
          ) : groupByOe && grouped ? (
            <div className="space-y-6">
              {grouped.map(([oe, items]) => (
                <div key={oe}>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-sm">
                      OE: {oe}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {items.length} requisição(ões)
                    </span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nº OE</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Depto</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead className="text-center">Qtd</TableHead>
                        <TableHead>Prioridade</TableHead>
                        <TableHead>Prazo</TableHead>
                        <TableHead>Solicitante</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>{items.map(renderRow)}</TableBody>
                  </Table>
                </div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº OE</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Depto</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="text-center">Qtd</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{filtered.map(renderRow)}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Excluir Requisição"
        description="Deseja realmente excluir esta requisição? Esta ação não pode ser desfeita e todos os registros relacionados (histórico, comentários, anexos, notificações) serão removidos."
        confirmText="Sim, Excluir"
        cancelText="Cancelar"
        variant="destructive"
        loading={deleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
