import { useState, useEffect } from 'react'
import { getUsers, updateUser } from '@/services/users'
import { getDepartamentos } from '@/services/departamentos'
import { UserRecord, DepartamentoRecord } from '@/types'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { extractFieldErrors, getErrorMessage, type FieldErrors } from '@/lib/pocketbase/errors'
import { Building2, X, Check } from 'lucide-react'

export function UserDepartmentManager() {
  const { isSuperAdmin } = useAuth()
  const [users, setUsers] = useState<UserRecord[]>([])
  const [departamentos, setDepartamentos] = useState<DepartamentoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const loadData = async () => {
    try {
      const [userData, deptData] = await Promise.all([getUsers(), getDepartamentos()])
      setUsers(userData)
      setDepartamentos(deptData)
    } catch {
      toast.error('Erro ao carregar usuários')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isSuperAdmin) {
      loadData()
    } else {
      setLoading(false)
    }
  }, [isSuperAdmin])

  useRealtime(
    'users',
    () => {
      if (isSuperAdmin) {
        getUsers()
          .then(setUsers)
          .catch(() => {})
      }
    },
    isSuperAdmin,
  )

  if (!isSuperAdmin) return null

  const startEdit = (user: UserRecord) => {
    setEditingId(user.id)
    setEditValue(user.departamento || '')
    setFieldErrors({})
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValue('')
    setFieldErrors({})
  }

  const saveEdit = async (userId: string) => {
    setSaving(true)
    setFieldErrors({})
    try {
      await updateUser(userId, { departamento: editValue || null }, { expand: 'departamento' })
      toast.success('Departamento atualizado com sucesso!')
      setEditingId(null)
      loadData()
    } catch (err) {
      setFieldErrors(extractFieldErrors(err))
      toast.error(getErrorMessage(err) || 'Erro ao atualizar departamento')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-indigo-600" />
          Gestão de Departamentos dos Usuários
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-slate-500 py-4 text-center">Carregando...</p>
        ) : (
          <div className="space-y-1">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between gap-2 py-2 border-b border-slate-100 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 truncate">{u.name}</p>
                  <p className="text-xs text-slate-500 truncate">{u.email}</p>
                </div>
                {editingId === u.id ? (
                  <div className="flex items-center gap-1.5">
                    <Select value={editValue} onValueChange={setEditValue}>
                      <SelectTrigger className="h-8 w-40 text-xs">
                        <SelectValue placeholder="Departamento" />
                      </SelectTrigger>
                      <SelectContent>
                        {departamentos.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {editValue && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => setEditValue('')}
                        title="Limpar departamento"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="icon"
                      className="h-8 w-8 shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white"
                      disabled={saving}
                      onClick={() => saveEdit(u.id)}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={cancelEdit}
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        u.expand?.departamento?.nome
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200 text-xs'
                          : 'bg-slate-100 text-slate-500 border-slate-200 text-xs'
                      }
                    >
                      {u.expand?.departamento?.nome || 'Sem departamento'}
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-slate-600 hover:text-indigo-600"
                      onClick={() => startEdit(u)}
                    >
                      Editar
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {Object.keys(fieldErrors).length > 0 && (
              <div className="mt-2 space-y-1">
                {Object.entries(fieldErrors).map(([field, msg]) => (
                  <p key={field} className="text-[11px] text-rose-500">
                    {msg}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
