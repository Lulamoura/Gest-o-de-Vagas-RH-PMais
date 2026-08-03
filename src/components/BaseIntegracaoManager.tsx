import { useState, useEffect, useMemo } from 'react'
import {
  getBaseIntegracao,
  createBaseIntegracao,
  updateBaseIntegracao,
  deleteBaseIntegracao,
} from '@/services/base_integracao'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
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
import { PlusCircle, Pencil, Trash2, Search, MapPin } from 'lucide-react'
import { BaseIntegracaoRecord } from '@/types'

const emptyForm = {
  nome: '',
  endereco: '',
  telefone: '',
  email: '',
  pessoa_contato: '',
}

export function BaseIntegracaoManager() {
  const { isAdmin, isSuperAdmin } = useAuth()
  const canManage = isAdmin || isSuperAdmin
  const [records, setRecords] = useState<BaseIntegracaoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = async () => {
    try {
      const data = await getBaseIntegracao()
      setRecords(data)
    } catch {
      toast.error('Erro ao carregar bases de integração')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime<BaseIntegracaoRecord>('base_integracao', () => {
    loadData()
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return records
    return records.filter((r) =>
      [r.nome, r.endereco, r.telefone, r.email, r.pessoa_contato]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    )
  }, [records, search])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (r: BaseIntegracaoRecord) => {
    setEditingId(r.id)
    setForm({
      nome: r.nome || '',
      endereco: r.endereco || '',
      telefone: r.telefone || '',
      email: r.email || '',
      pessoa_contato: r.pessoa_contato || '',
    })
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nome.trim()) {
      toast.error('Nome é obrigatório')
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        await updateBaseIntegracao(editingId, form)
        toast.success('Base de integração atualizada!')
      } else {
        await createBaseIntegracao(form)
        toast.success('Base de integração criada!')
      }
      setModalOpen(false)
      loadData()
    } catch {
      toast.error('Erro ao salvar base de integração')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await deleteBaseIntegracao(deleteId)
      toast.success('Base de integração excluída')
      loadData()
    } catch {
      toast.error('Erro ao excluir base de integração')
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  return (
    <Card className="border-slate-200 shadow-2xs">
      <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <CardTitle className="text-base font-bold text-slate-900 flex items-center space-x-2">
          <MapPin className="h-5 w-5 text-indigo-600" />
          <span>Base de Integração ({records.length})</span>
        </CardTitle>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Buscar base..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 w-56 text-sm"
            />
          </div>
          {canManage && (
            <Button
              size="sm"
              onClick={openCreate}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              <PlusCircle className="h-4 w-4 mr-1.5" /> Nova Base
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="text-xs font-semibold text-slate-600">Nome</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600">Endereço</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600">Telefone</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600">E-mail</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600">
                Pessoa de Contato
              </TableHead>
              {canManage && (
                <TableHead className="text-xs font-semibold text-slate-600 text-right">
                  Ações
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={canManage ? 6 : 5} className="text-center py-6 text-slate-500">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 6 : 5}
                  className="text-center py-6 text-slate-500 text-sm"
                >
                  {search ? 'Nenhuma base encontrada.' : 'Nenhuma base cadastrada.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id} className="hover:bg-slate-50">
                  <TableCell className="font-semibold text-slate-900 text-sm">{r.nome}</TableCell>
                  <TableCell className="text-slate-600 text-sm">{r.endereco || '—'}</TableCell>
                  <TableCell className="text-slate-600 text-sm">{r.telefone || '—'}</TableCell>
                  <TableCell className="text-slate-600 text-sm">{r.email || '—'}</TableCell>
                  <TableCell className="text-slate-600 text-sm">
                    {r.pessoa_contato || '—'}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(r)}
                        className="h-8 w-8 text-slate-600 hover:text-amber-600"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(r.id)}
                        className="h-8 w-8 text-slate-600 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Editar Base de Integração' : 'Nova Base de Integração'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Atualize os dados da base.'
                : 'Preencha os dados da nova base de integração.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Nome *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Endereço</Label>
              <Input
                value={form.endereco}
                onChange={(e) => setForm({ ...form, endereco: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Telefone</Label>
                <Input
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">E-mail</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Pessoa de Contato</Label>
              <Input
                value={form.pessoa_contato}
                onChange={(e) => setForm({ ...form, pessoa_contato: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Base de Integração</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta base? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-500 text-white"
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

export default BaseIntegracaoManager
