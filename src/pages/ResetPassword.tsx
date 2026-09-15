import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { confirmPasswordReset } from '@/services/users'
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
import { Lock, Eye, EyeOff, KeyRound, Check, ArrowRight } from 'lucide-react'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const tokenFromUrl = searchParams.get('token') || ''
  const navigate = useNavigate()

  const [token, setToken] = useState(tokenFromUrl)
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!token.trim()) {
      errs.token = 'Token de validação não encontrado.'
    }
    if (!password) {
      errs.password = 'Nova senha é obrigatória.'
    } else if (password.length < 8) {
      errs.password = 'A senha deve ter no mínimo 8 caracteres.'
    }
    if (!passwordConfirm) {
      errs.passwordConfirm = 'Confirmação de senha é obrigatória.'
    } else if (password !== passwordConfirm) {
      errs.passwordConfirm = 'As senhas não coincidem.'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      await confirmPasswordReset(token.trim(), password, passwordConfirm)
      setSuccess(true)
      toast.success('Senha redefinida com sucesso! Você já pode entrar com a nova senha.')
    } catch (err: any) {
      const msg =
        err?.data?.message ||
        err?.message ||
        'Token inválido ou expirado. Por favor, solicite uma nova redefinição.'
      toast.error(msg)
      setErrors({ token: 'Token inválido ou expirado.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <Card className="w-full max-w-md border-slate-800 bg-slate-950/90 text-slate-100 shadow-2xl backdrop-blur relative z-10">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-indigo-600 flex items-center justify-center font-black text-white text-2xl shadow-lg mb-3">
            <KeyRound className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-white">
            Redefinir Senha
          </CardTitle>
          <CardDescription className="text-slate-400 text-sm">
            {success
              ? 'Sua senha foi redefinida com sucesso!'
              : 'Defina uma nova senha para acessar o módulo RH PMais.'}
          </CardDescription>
        </CardHeader>

        {success ? (
          <CardContent className="space-y-4 pt-4 text-center">
            <div className="p-4 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-sm">
              <Check className="h-8 w-8 mx-auto mb-2 text-emerald-400" />
              Sua senha foi atualizada. Agora você pode fazer login no sistema com suas novas
              credenciais.
            </div>
            <Button
              onClick={() => navigate('/login')}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-lg shadow-md transition-all flex items-center justify-center space-x-2 mt-4"
            >
              <span>Ir para a tela de Login</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4 pt-4">
              {!tokenFromUrl && (
                <div className="space-y-1.5">
                  <Label htmlFor="token" className="text-slate-200 text-xs font-semibold">
                    Código/Token de Recuperação <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="token"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Cole aqui o token recebido por e-mail"
                    className={`bg-slate-900 border-slate-800 text-slate-100 placeholder:text-slate-500 ${
                      errors.token ? 'border-rose-500' : ''
                    }`}
                    required
                  />
                  {errors.token && <p className="text-[11px] text-rose-500">{errors.token}</p>}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="new-pass" className="text-slate-200 text-xs font-semibold">
                  Nova Senha <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="new-pass"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`pl-9 pr-10 bg-slate-900 border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:ring-indigo-500 ${
                      errors.password ? 'border-rose-500' : ''
                    }`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-[11px] text-rose-500">{errors.password}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-pass" className="text-slate-200 text-xs font-semibold">
                  Confirmar Nova Senha <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <Check className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="confirm-pass"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Repita a nova senha"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    className={`pl-9 pr-10 bg-slate-900 border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:ring-indigo-500 ${
                      errors.passwordConfirm ? 'border-rose-500' : ''
                    }`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-200"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.passwordConfirm && (
                  <p className="text-[11px] text-rose-500">{errors.passwordConfirm}</p>
                )}
              </div>
            </CardContent>

            <CardFooter className="pt-2 pb-6 flex flex-col space-y-3">
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-lg shadow-md transition-all flex items-center justify-center space-x-2"
              >
                <span>{loading ? 'Salvando nova senha...' : 'Definir Nova Senha'}</span>
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>

              <Link
                to="/login"
                className="text-xs text-slate-400 hover:text-indigo-400 hover:underline transition-colors text-center"
              >
                Voltar para o Login
              </Link>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  )
}
