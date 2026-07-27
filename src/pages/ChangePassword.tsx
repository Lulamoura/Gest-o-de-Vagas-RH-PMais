import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import pb from '@/lib/pocketbase/client'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Lock, Eye, EyeOff, ArrowLeft, KeyRound, Check } from 'lucide-react'

export default function ChangePassword() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!currentPassword) errs.currentPassword = 'Senha atual é obrigatória.'
    if (!newPassword) {
      errs.newPassword = 'Nova senha é obrigatória.'
    } else if (newPassword.length < 8) {
      errs.newPassword = 'A nova senha deve ter no mínimo 8 caracteres.'
    }
    if (!confirmPassword) {
      errs.confirmPassword = 'Confirmação de senha é obrigatória.'
    } else if (newPassword !== confirmPassword) {
      errs.confirmPassword = 'As senhas não coincidem.'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    if (!user?.email) return

    setLoading(true)
    try {
      await pb.collection('users').authWithPassword(user.email, currentPassword)
      await pb.collection('users').update(user.id, {
        password: newPassword,
        passwordConfirm: newPassword,
      })
      toast.success('Senha alterada com sucesso!')
      navigate('/dashboard')
    } catch (err: any) {
      if (err?.status === 401) {
        setErrors({ currentPassword: 'Senha atual incorreta.' })
      } else {
        toast.error('Erro ao alterar senha. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-md mx-auto">
      <Button variant="ghost" onClick={() => navigate('/dashboard')} className="text-slate-600">
        <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
      </Button>

      <Card className="border-slate-200 shadow-md">
        <CardHeader className="bg-slate-50/80 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-slate-900">Alterar Senha</CardTitle>
              <CardDescription className="text-xs">
                Mantenha sua conta segura com uma senha forte
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current" className="text-xs font-bold text-slate-700">
                Senha Atual <span className="text-rose-500">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="current"
                  type={showCurrent ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={`pl-9 pr-10 ${errors.currentPassword ? 'border-rose-500' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.currentPassword && (
                <p className="text-[11px] text-rose-500">{errors.currentPassword}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new" className="text-xs font-bold text-slate-700">
                Nova Senha <span className="text-rose-500">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="new"
                  type={showNew ? 'text' : 'password'}
                  placeholder="Mínimo 8 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={`pl-9 pr-10 ${errors.newPassword ? 'border-rose-500' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.newPassword && (
                <p className="text-[11px] text-rose-500">{errors.newPassword}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm" className="text-xs font-bold text-slate-700">
                Confirmar Nova Senha <span className="text-rose-500">*</span>
              </Label>
              <div className="relative">
                <Check className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="confirm"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Repita a nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`pl-9 pr-10 ${errors.confirmPassword ? 'border-rose-500' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-[11px] text-rose-500">{errors.confirmPassword}</p>
              )}
            </div>
          </CardContent>

          <CardFooter className="bg-slate-50 border-t border-slate-200 p-4 flex justify-between">
            <Button type="button" variant="outline" onClick={() => navigate('/dashboard')}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm"
            >
              <KeyRound className="h-4 w-4 mr-2" />
              {loading ? 'Alterando...' : 'Alterar Senha'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
