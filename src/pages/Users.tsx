import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  requestPasswordReset,
} from '@/services/users'
import { getDepartamentos } from '@/services/departamentos'
import { setRemoteAccessPermission, setUserActiveStatus } from '@/services/access-control'
import { UserRecord, UserProfile, DepartamentoRecord } from '@/types'
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
import { Switch } from '@/components/ui/switch'
import { extractFieldErrors, getErrorMessage, type FieldErrors } from '@/lib/pocketbase/errors'
import { toast } from 'sonner'
import { PlusCircle, Pencil, Trash2, X, KeyRound, UserCheck, UserX } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useRealtime } from '@/hooks/use-realtime'

export default function Users() {
  const { canManageUsers, isSuperAdmin } = useAuth()
  const [usersList, setUsersList] = useState<UserRecord[]>([])
  const [departamentos, setDepartamentos] = useState<DepartamentoRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null)

  // Form
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [profile, setProfile] = useState<UserProfile>('viewer')
  const [departamento, setDepartamento] = useState<string>('')
  const [permitirAcessoRemoto, setPermitirAcessoRemoto] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const [userToDelete, setUserToDelete] = useState<UserRecord | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [userToReset, setUserToReset] = useState<UserRecord | null>(null)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetting, setResetting] = useState(false)

  const [userToToggleAtivo, setUserToToggleAtivo] = useState<UserRecord | null>(null)
  const [toggleAtivoDialogOpen, setToggleAtivoDialogOpen] = useState(false)
  const [togglingAtivo, setTogglingAtivo] = useState(false)

  const loadData = async () => {
    try {
      const [data, depts] = await Promise.all([getUsers(), getDepartamentos()])
      setUsersList(data)
      setDepartamentos(depts)
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

  useRealtime(
    'departamentos',
    () => {
      getDepartamentos()
        .then(setDepartamentos)
        .catch(() => {})
    },
    canManageUsers,
  )

  useRealtime(
    'users',
    () => {
      getUsers()
        .then(setUsersList)
        .catch(() => {})
    },
    canManageUsers,
  )

  if (!canManageUsers) {
    return <Navigate to="/dashboard" replace />
  }

  const openCreateModal = () => {
    setEditingUser(null)
    setName('')
    setEmail('')
    setPassword('')
    setProfile('operator')
    setDepartamento('')
    setPermitirAcessoRemoto(false)
    setFieldErrors({})
    setModalOpen(true)
  }

  const openEditModal = (u: UserRecord) => {
    setEditingUser(u)
    setName(u.name)
    setEmail(u.email)
    setPassword('')
    setProfile(u.profile || 'viewer')
    setDepartamento(u.departamento || '')
    setPermitirAcessoRemoto(u.permitir_acesso_fora_pmais === true)
    setFieldErrors({})
    setModalOpen(true)
  }

  const handleSelectDepartamento = (val: string) => {
    setDepartamento(val)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) {
      toast.error('Nome e email são obrigatórios')
      return
    }

    if (profile === 'superadmin' && !isSuperAdmin) {
      toast.error('Você não tem permissão para atribuir o perfil Super Admin.')
      return
    }

    setSaving(true)
    setFieldErrors({})
    try {
      if (editingUser) {
        const updateData: Record<string, any> = { name, profile }
        if (isSuperAdmin) {
          updateData.departamento = departamento || null
        }
        const remotePermissionChanged =
          isSuperAdmin && editingUser.permitir_acesso_fora_pmais !== permitirAcessoRemoto
        if (remotePermissionChanged && !permitirAcessoRemoto) {
          await setRemoteAccessPermission(editingUser.id, false)
        }
        await updateUser(editingUser.id, updateData, { expand: 'departamento' })
        if (remotePermissionChanged && permitirAcessoRemoto) {
          await setRemoteAccessPermission(editingUser.id, true)
        }
        toast.success('Usuário atualizado com sucesso!')
      } else {
        if (!password) {
          toast.error('A senha é obrigatória para novos usuários.')
          setSaving(false)
          return
        }
        const createData: Parameters<typeof createUser>[0] = {
          name,
          email,
          password,
          profile,
          permitir_acesso_fora_pmais: false,
        }
        if (isSuperAdmin) createData.departamento = departamento
        const createdUser = await createUser(createData)
        if (isSuperAdmin && permitirAcessoRemoto) {
          await setRemoteAccessPermission(createdUser.id, true)
        }
        toast.success('Usuário criado com sucesso!')
      }
      setModalOpen(false)
      loadData()
    } catch (err) {
      setFieldErrors(extractFieldErrors(err))
      const errMsg = getErrorMessage(err)
      toast.error(errMsg || 'Erro ao salvar usuário. Verifique os campos e tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const promptDelete = (u: UserRecord) => {
    setUserToDelete(u)
    setDeleteDialogOpen(true)
  }

  const promptResetPassword = (u: UserRecord) => {
    setUserToReset(u)
    setResetDialogOpen(true)
  }

  const promptToggleAtivo = (u: UserRecord) => {
    setUserToToggleAtivo(u)
    setToggleAtivoDialogOpen(true)
  }

  const handleConfirmToggleAtivo = async () => {
    if (!userToToggleAtivo) return
    const novoStatus = userToToggleAtivo.ativo === false ? true : false
    setTogglingAtivo(true)
    try {
      await setUserActiveStatus(userToToggleAtivo.id, novoStatus)
      toast.success(
        novoStatus
          ? `Usuário ${userToToggleAtivo.name} ativado com sucesso!`
          : `Usuário ${userToToggleAtivo.name} desativado com sucesso!`,
      )
      setToggleAtivoDialogOpen(false)
      setUserToToggleAtivo(null)
      loadData()
    } catch (err) {
      toast.error(
        getErrorMessage(err) ||
          `Erro ao ${novoStatus ? 'ativar' : 'desativar'} usuário. Tente novamente.`,
      )
    } finally {
      setTogglingAtivo(false)
    }
  }

  const handleConfirmResetPassword = async () => {
    if (!userToReset || !userToReset.email) return
    setResetting(true)
    try {
      await requestPasswordReset(userToReset.email)
      toast.success(`E-mail de redefinição enviado para ${userToReset.email}`)
      setResetDialogOpen(false)
      setUserToReset(null)
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Erro ao enviar e-mail de redefinição de senha.')
    } finally {
      setResetting(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!userToDelete) return
    setDeleting(true)
    try {
      await deleteUser(userToDelete.id)
      toast.success('Usuário removido com sucesso!')
      setDeleteDialogOpen(false)
      setUserToDelete(null)
      loadData()
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Erro ao excluir usuário')
    } finally {
      setDeleting(false)
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
                <TableHead className="text-xs font-semibold text-slate-600">Departamento</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Criado em</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 text-right">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : (
                usersList.map((u) => (
                  <TableRow
                    key={u.id}
                    className={`hover:bg-slate-50 ${u.ativo === false ? 'bg-slate-50/60 opacity-80' : ''}`}
                  >
                    <TableCell className="font-bold text-slate-900 text-sm">
                      <div className="flex items-center gap-2">
                        <span>{u.name}</span>
                        <Badge
                          variant="outline"
                          className={
                            u.ativo === false
                              ? 'bg-slate-100 text-slate-600 border-slate-300 text-[10px] px-1.5 py-0 font-medium'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0 font-medium'
                          }
                        >
                          {u.ativo === false ? 'Inativo' : 'Ativo'}
                        </Badge>
                      </div>
                    </TableCell>
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
                    <TableCell className="text-xs text-slate-600">
                      {u.expand?.departamento?.nome || 'Sem departamento'}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {formatDateBR(u.created)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => promptToggleAtivo(u)}
                          title={u.ativo === false ? 'Ativar Acesso' : 'Desativar Acesso'}
                          className={`h-8 w-8 ${
                            u.ativo === false
                              ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                              : 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                          }`}
                        >
                          {u.ativo === false ? (
                            <UserCheck className="h-4 w-4" />
                          ) : (
                            <UserX className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => promptResetPassword(u)}
                          title="Resetar Senha"
                          className="h-8 w-8 text-slate-600 hover:text-indigo-600"
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal(u)}
                          title="Editar Usuário"
                          className="h-8 w-8 text-slate-600 hover:text-amber-600"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => promptDelete(u)}
                          title="Excluir Usuário"
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
                  <SelectItem value="admin">Administrador (Gestão Completa)</SelectItem>
                  {isSuperAdmin && (
                    <SelectItem value="superadmin">Super Admin (Acesso Total)</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Departamento</Label>
              <div className="flex items-center gap-2">
                <Select
                  value={departamento}
                  onValueChange={handleSelectDepartamento}
                  disabled={!isSuperAdmin}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {departamentos.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isSuperAdmin && departamento && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-slate-500 hover:text-rose-600"
                    onClick={() => setDepartamento('')}
                    title="Limpar departamento"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {fieldErrors.departamento && (
                <p className="text-[11px] text-rose-500">{fieldErrors.departamento}</p>
              )}
              {!isSuperAdmin && (
                <p className="text-[11px] text-slate-500">
                  Apenas Super Admin pode alterar o departamento.
                </p>
              )}
            </div>

            {isSuperAdmin && (
              <div className="flex items-center justify-between rounded-md border border-slate-200 p-3">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="permitirAcessoRemoto"
                    className="text-xs font-bold text-slate-700"
                  >
                    Permitir acesso fora da PMais
                  </Label>
                  <p className="text-[11px] text-slate-500">
                    Exige código enviado ao e-mail cadastrado quando a restrição global estiver
                    ativa.
                  </p>
                </div>
                <Switch
                  id="permitirAcessoRemoto"
                  checked={permitirAcessoRemoto}
                  onCheckedChange={setPermitirAcessoRemoto}
                />
              </div>
            )}

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

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Confirmação de Exclusão"
        description="Deseja realmente excluir este usuário?"
        confirmText="Confirmar"
        cancelText="Cancelar"
        variant="destructive"
        loading={deleting}
        onConfirm={handleConfirmDelete}
      />

      <ConfirmDialog
        open={resetDialogOpen}
        onOpenChange={setResetDialogOpen}
        title="Resetar Senha de Usuário"
        description={`Deseja enviar as instruções de redefinição de senha para o e-mail de ${userToReset?.name || 'usuário'} (${userToReset?.email})?`}
        confirmText="Enviar E-mail de Reset"
        cancelText="Cancelar"
        variant="primary"
        loading={resetting}
        onConfirm={handleConfirmResetPassword}
      />

      <ConfirmDialog
        open={toggleAtivoDialogOpen}
        onOpenChange={setToggleAtivoDialogOpen}
        title={
          userToToggleAtivo?.ativo === false
            ? 'Ativar Acesso do Usuário'
            : 'Desativar Acesso do Usuário'
        }
        description={
          userToToggleAtivo?.ativo === false
            ? `Deseja reativar o acesso de ${userToToggleAtivo?.name || 'usuário'} (${userToToggleAtivo?.email})? O usuário voltará a ter acesso ao sistema.`
            : `Deseja desativar o acesso de ${userToToggleAtivo?.name || 'usuário'} (${userToToggleAtivo?.email})? O usuário não poderá mais acessar o sistema. O histórico e os registros vinculados a ele serão preservados.`
        }
        confirmText={userToToggleAtivo?.ativo === false ? 'Reativar Usuário' : 'Desativar Usuário'}
        cancelText="Cancelar"
        variant={userToToggleAtivo?.ativo === false ? 'primary' : 'destructive'}
        loading={togglingAtivo}
        onConfirm={handleConfirmToggleAtivo}
      />
    </div>
  )
}
