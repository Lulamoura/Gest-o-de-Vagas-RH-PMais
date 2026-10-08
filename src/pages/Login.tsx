import { useEffect, useState } from 'react'
import type { RemoteMfaChallengeResponse } from '@/services/access-control'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { requestPasswordReset } from '@/services/users'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { Lock, Mail, Eye, EyeOff, AlertTriangle, ArrowRight, KeyRound } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [challenge, setChallenge] = useState<RemoteMfaChallengeResponse | null>(null)
  const [otpCode, setOtpCode] = useState('')
  const [resendSeconds, setResendSeconds] = useState(0)

  // Forgot password modal state
  const [forgotModalOpen, setForgotModalOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)

  const { signIn, verifyRemoteCode, resendRemoteCode } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (resendSeconds <= 0) return
    const timer = window.setInterval(() => {
      setResendSeconds((current) => Math.max(0, current - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [resendSeconds])

  const getErrorMessage = (err: unknown) => {
    if (!err || typeof err !== 'object') return ''
    const value = err as {
      message?: string
      response?: { message?: string }
      data?: { message?: string }
    }
    return value.response?.message || value.data?.message || value.message || ''
  }

  const presentLoginError = (err: unknown) => {
    const message = getErrorMessage(err)
    if (message.includes('Acesso remoto não autorizado')) {
      setError('Acesso remoto não autorizado')
    } else if (message.includes('Usuário inativo')) {
      setError('Usuário inativo. Contate o administrador.')
    } else {
      setError('Email ou senha inválidos. Verifique suas credenciais.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await signIn(email, password)
    setLoading(false)

    if (result.error) {
      presentLoginError(result.error)
    } else if (result.challenge) {
      setChallenge(result.challenge)
      setPassword('')
      setResendSeconds(result.challenge.resendAfter)
    } else {
      navigate('/dashboard')
    }
  }

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!challenge || !/^\d{6}$/.test(otpCode)) {
      setError('Informe o código numérico de seis dígitos.')
      return
    }
    setError(null)
    setLoading(true)
    const result = await verifyRemoteCode(challenge.challengeId, otpCode)
    setLoading(false)
    if (result.error) {
      setError('Código inválido ou expirado.')
      return
    }
    navigate('/dashboard')
  }

  const handleResend = async () => {
    if (!challenge || resendSeconds > 0 || loading) return
    setError(null)
    setLoading(true)
    const result = await resendRemoteCode(challenge.challengeId)
    setLoading(false)
    if (result.error || !result.challenge) {
      setError('Não foi possível reenviar o código. Tente novamente.')
      return
    }
    setChallenge(result.challenge)
    setOtpCode('')
    setResendSeconds(result.challenge.resendAfter)
    toast.success('Novo código enviado ao e-mail cadastrado.')
  }

  const handleOpenForgotPassword = () => {
    setForgotEmail(email || '')
    setForgotModalOpen(true)
  }

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!forgotEmail.trim()) {
      toast.error('Informe seu e-mail corporativo.')
      return
    }

    setForgotLoading(true)
    try {
      await requestPasswordReset(forgotEmail.trim())
      toast.success(`E-mail de redefinição enviado para ${forgotEmail.trim()}`)
      setForgotModalOpen(false)
    } catch {
      // Por segurança e padrão PB, se o email não existir ou falhar
      toast.error(
        'Não foi possível enviar o e-mail de recuperação. Verifique o endereço e tente novamente.',
      )
    } finally {
      setForgotLoading(false)
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
            P+
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-white">
            PMais RH — Módulo de Vagas
          </CardTitle>
          <CardDescription className="text-slate-400 text-sm">
            {challenge
              ? `Digite o código enviado para ${challenge.maskedEmail}.`
              : 'Acesse o sistema para gestão de vagas, pipeline de candidatos e indicadores.'}
          </CardDescription>
        </CardHeader>

        <form onSubmit={challenge ? handleOtpSubmit : handleSubmit}>
          <CardContent className="space-y-4 pt-4">
            {error && (
              <Alert variant="destructive" className="bg-rose-950/50 border-rose-800 text-rose-300">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!challenge ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-200">
                    Email Corporativo
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="usuario@pmaisservicos.com.br"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9 bg-slate-900 border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:ring-indigo-500"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-200">
                    Senha
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 pr-10 bg-slate-900 border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:ring-indigo-500"
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
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="otp-code" className="text-slate-200">
                  Código de acesso
                </Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="otp-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={otpCode}
                    onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ''))}
                    className="pl-9 bg-slate-900 border-slate-800 text-slate-100 tracking-[0.4em] focus-visible:ring-indigo-500"
                    required
                    autoFocus
                  />
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="pt-2 pb-6 flex flex-col space-y-3">
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-lg shadow-md transition-all flex items-center justify-center space-x-2"
            >
              <span>
                {loading
                  ? challenge
                    ? 'Validando...'
                    : 'Entrando...'
                  : challenge
                    ? 'Validar código'
                    : 'Entrar no Módulo'}
              </span>
              {!loading && <ArrowRight className="h-4 w-4" />}
            </Button>

            {challenge ? (
              <>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading || resendSeconds > 0}
                  className="text-xs text-slate-400 hover:text-indigo-400 disabled:opacity-50 transition-colors"
                >
                  {resendSeconds > 0 ? `Reenviar código em ${resendSeconds}s` : 'Reenviar código'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChallenge(null)
                    setOtpCode('')
                    setError(null)
                  }}
                  className="text-xs text-slate-400 hover:text-indigo-400 transition-colors"
                >
                  Voltar ao login
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleOpenForgotPassword}
                className="text-xs text-slate-400 hover:text-indigo-400 hover:underline transition-colors focus:outline-none"
              >
                Esqueci minha senha
              </button>
            )}
          </CardFooter>
        </form>
      </Card>

      <Dialog open={forgotModalOpen} onOpenChange={setForgotModalOpen}>
        <DialogContent className="sm:max-w-md bg-slate-950 border-slate-800 text-slate-100">
          <DialogHeader>
            <div className="flex items-center space-x-2 text-indigo-400 mb-1">
              <KeyRound className="h-5 w-5" />
              <DialogTitle className="text-lg font-bold text-white">
                Recuperação de Senha
              </DialogTitle>
            </div>
            <DialogDescription className="text-slate-400 text-xs">
              Informe seu e-mail cadastrado para receber as instruções e o link seguro de
              redefinição de senha.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="forgot-email" className="text-xs font-semibold text-slate-200">
                Email Corporativo
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="usuario@pmaisservicos.com.br"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="pl-9 bg-slate-900 border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:ring-indigo-500"
                  required
                />
              </div>
            </div>

            <DialogFooter className="pt-2 flex sm:justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setForgotModalOpen(false)}
                className="border-slate-800 text-slate-300 hover:bg-slate-900 hover:text-white"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={forgotLoading}
                className="bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                {forgotLoading ? 'Enviando...' : 'Enviar Link de Redefinição'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
