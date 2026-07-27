import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { getUsers, createUser, updateUser, deleteUser } from '@/services/users'
import { UserRecord, UserProfile } from '@/types'
import { useAuth } from '@/hooks/use-auth'
import { formatDateBR } from '@/lib/status-utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { extractFieldErrors, getErrorMessage, type FieldErrors } from '@/lib/pocketbase/errors'
import { toast } from 'sonner'
import { UserCheck, PlusCircle, Pencil, Trash2, Shield } from 'lucide-react'

export default function Users() {
  const { canManageUsers } = useAuth()
  const [usersList, setUsersList] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null)

  // Form
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [profile, setProfile] = useState<UserProfile>('viewer')
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const loadData = async () => {
    try {
      const data = await getUsers()
      setUsersList(data)
    } catch (err) {
      toast.error('Erro ao carregar usuários')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!canManageUsers) {
      toast.error('Você não tem permissão para acessar a gestão de usuários.')
      return
    }
    loadData()
  }, [canManageUsers])

  if (!canManageUsers) {
    return <Navigate to="/dashboard" replace />
  }

  const openCreateModal = () => {
    setEditingUser(null)
    setName('')
    setEmail('')
    setPassword('')
    setProfile('operator')
    setFieldErrors({})
    setModalOpen(true)
  }

  const openEditModal = (u: UserRecord) => {
    setEditingUser(u)
    setName(u.name)
    setEmail(u.email)
    setPassword('')
    setProfile(u.profile || 'viewer')
    setFieldErrors({})
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) {
      toast.error('Nome e email são obrigatórios')
      return
    }

    setSaving(true)
    try {
      if (editingUser) {
        await updateUser(editingUser.id, { name, profile })
        toast.success('Usuário atualizado com sucesso!')
      } else {
        if (!password) {
          toast.error('A senha é obrigatória para novos usuários.')
          setSaving(false)
          return
        }
        await createUser({ name, email, password, profile })
        toast.success('Usuário criado com sucesso!')
      }
      setModalOpen(false)
      loadData()
    } catch (err) {
      setFieldErrors(extractFieldErrors(err))
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este usuário?')) return
    try {
      await deleteUser(id)
      toast.success('Usuário removido')
      loadData()
    } catch (err) {
      toast.error('Erro ao excluir usuário')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Gestão de Usuários</h2>
          <p className="text-xs text-slate-500">
            Controle de acessos, perfis e permissões do Módulo de RH
          </p>
        </div>

        <Button
          onClick={openCreateModal}
          className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm"
        >
          <PlusCircle className="h-4 w-4 mr-2" /> Novo Usuário
        </Button>
      </div>

      <Card className="border-slate-200 shadow-2xs">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-xs font-semibold text-slate-600">Nome</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Email</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">
                  Perfil / Permissão
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Criado em</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 text-right">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : (
                usersList.map((u) => (
                  <TableRow key={u.id} className="hover:bg-slate-50">
                    <TableCell className="font-bold text-slate-900 text-sm">{u.name}</TableCell>
                    <TableCell className="text-xs text-slate-600">{u.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          u.profile === 'superadmin'
                            ? 'bg-purple-100 text-purple-800 border-purple-200 font-semibold'
                            : u.profile === 'admin'
                              ? 'bg-indigo-100 text-indigo-800 border-indigo-200 font-semibold'
                              : u.profile === 'operator'
                                ? 'bg-blue-100 text-blue-800 border-blue-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                        }
                      >
                        {u.profile === 'superadmin'
                          ? 'Super Admin'
                          : u.profile === 'admin'
                            ? 'Administrador'
                            : u.profile === 'operator'
                              ? 'Operador'
                              : 'Visualizador'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {formatDateBR(u.created)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal(u)}
                          className="h-8 w-8 text-slate-600 hover:text-amber-600"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(u.id)}
                          className="h-8 w-8 text-slate-600 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
            <DialogDescription>Defina os dados de conta e nível de acesso</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="uName" className="text-xs font-bold text-slate-700">
                Nome
              </Label>
              <Input id="uName" value={name} onChange={(e) => setName(e.target.value)} required />
              {fieldErrors.name && <p className="text-[11px] text-rose-500">{fieldErrors.name}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="uEmail" className="text-xs font-bold text-slate-700">
                Email
              </Label>
              <Input
                id="uEmail"
                type="email"
                value={email}
                disabled={!!editingUser}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {fieldErrors.email && (
                <p className="text-[11px] text-rose-500">{fieldErrors.email}</p>
              )}
            </div>

            {!editingUser && (
              <div className="space-y-1.5">
                <Label htmlFor="uPass" className="text-xs font-bold text-slate-700">
                  Senha Inicial
                </Label>
                <Input
                  id="uPass"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                />
                {fieldErrors.password && (
                  <p className="text-[11px] text-rose-500">{fieldErrors.password}</p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Perfil de Acesso</Label>
              <Select value={profile} onValueChange={(v) => setProfile(v as UserProfile)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o perfil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operator">Operador (Criar e Editar Vagas)</SelectItem>
                  <SelectItem value="viewer">Visualizador (Somente Leitura)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                {saving ? 'Salvando...' : 'Salvar Usuário'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
