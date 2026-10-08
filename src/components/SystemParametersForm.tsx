import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { updateSystemParameters } from '@/services/system_parameters'
import { useSystemParameters } from '@/hooks/use-system-parameters'
import { toast } from 'sonner'
import { Save, Settings } from 'lucide-react'
import { setRemoteAccessSettings } from '@/services/access-control'
import type { FieldErrors } from '@/lib/pocketbase/errors'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateCommaEmails(value: string): string | null {
  if (!value.trim()) return null
  const emails = value
    .split(',')
    .map((e) => e.trim())
    .filter((e) => e.length > 0)
  for (const email of emails) {
    if (!EMAIL_REGEX.test(email)) {
      return `E-mail inválido: ${email}`
    }
  }
  return null
}

function validateSingleEmail(value: string): string | null {
  if (!value.trim()) return null
  if (value.includes(',')) {
    return 'Apenas um e-mail é permitido neste campo.'
  }
  if (!EMAIL_REGEX.test(value.trim())) {
    return 'E-mail inválido.'
  }
  return null
}

function validateOfficeNetworks(value: string): string | null {
  const networks = value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
  if (networks.length === 0) return 'Informe ao menos uma rede da PMais.'
  for (const network of networks) {
    const match = network.match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/)
    if (!match) return `Rede inválida: ${network}`
    const octets = match[1].split('.').map(Number)
    const prefix = Number(match[2])
    if (octets.some((octet) => octet < 0 || octet > 255) || prefix !== 32) {
      return `Rede inválida: ${network}`
    }
    const canonical = `${octets.join('.')}/${prefix}`
    if (canonical !== network) return `Use o formato canônico da rede: ${canonical}`
  }
  return null
}

export function SystemParametersForm() {
  const { parameters, refresh } = useSystemParameters()
  const [prazoAlertaDias, setPrazoAlertaDias] = useState('30')
  const [nomeRemetente, setNomeRemetente] = useState('')
  const [emailRemetente, setEmailRemetente] = useState('')
  const [sloganPmais, setSloganPmais] = useState('')
  const [emailDpLista, setEmailDpLista] = useState('')
  const [emailOperacionalLista, setEmailOperacionalLista] = useState('')
  const [emailComercial, setEmailComercial] = useState('')
  const [restringirAcessoRedePmais, setRestringirAcessoRedePmais] = useState(false)
  const [redesPmaisAutorizadas, setRedesPmaisAutorizadas] = useState('143.208.130.134/32')
  const [saving, setSaving] = useState(false)
  const [recordId, setRecordId] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  useEffect(() => {
    if (parameters) {
      setPrazoAlertaDias(String(parameters.prazo_alerta_dias ?? 30))
      setNomeRemetente(parameters.nome_remetente || '')
      setEmailRemetente(parameters.email_remetente || '')
      setSloganPmais(parameters.slogan_pmais || '')
      setEmailDpLista(parameters.email_dp_lista || parameters.email_dp || '')
      setEmailOperacionalLista(
        parameters.email_operacional_lista || parameters.email_operacional || '',
      )
      setEmailComercial(parameters.email_comercial || '')
      setRestringirAcessoRedePmais(parameters.restringir_acesso_fora_pmais === true)
      setRedesPmaisAutorizadas(parameters.redes_autorizadas_pmais || '143.208.130.134/32')
      setRecordId(parameters.id)
    } else {
      setPrazoAlertaDias('30')
      setNomeRemetente('')
      setEmailRemetente('')
      setSloganPmais('')
      setEmailDpLista('')
      setEmailOperacionalLista('')
      setEmailComercial('')
      setRestringirAcessoRedePmais(false)
      setRedesPmaisAutorizadas('143.208.130.134/32')
      setRecordId(null)
    }
  }, [parameters])

  const validateAll = (): boolean => {
    const errors: FieldErrors = {}
    const senderErr = validateSingleEmail(emailRemetente)
    if (senderErr) errors.email_remetente = senderErr
    const dpErr = validateCommaEmails(emailDpLista)
    if (dpErr) errors.email_dp_lista = dpErr
    const opErr = validateCommaEmails(emailOperacionalLista)
    if (opErr) errors.email_operacional_lista = opErr
    const comErr = validateCommaEmails(emailComercial)
    if (comErr) errors.email_comercial = comErr
    const networksErr = validateOfficeNetworks(redesPmaisAutorizadas)
    if (networksErr) errors.redes_autorizadas_pmais = networksErr
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const dias = parseInt(prazoAlertaDias, 10)
    if (isNaN(dias) || dias <= 0) {
      toast.error('Prazo em dias deve ser um número positivo.')
      return
    }
    if (!validateAll()) {
      toast.error('Corrija os campos inválidos antes de salvar.')
      return
    }
    setSaving(true)
    try {
      const officeNetworks = redesPmaisAutorizadas
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean)
      const data = {
        prazo_alerta_dias: dias,
        nome_remetente: nomeRemetente,
        email_remetente: emailRemetente,
        slogan_pmais: sloganPmais,
        email_dp_lista: emailDpLista,
        email_operacional_lista: emailOperacionalLista,
        email_comercial: emailComercial,
      }
      if (!recordId) throw new Error('Parâmetros de segurança não encontrados.')
      await updateSystemParameters(recordId, data)
      await setRemoteAccessSettings(restringirAcessoRedePmais, officeNetworks)
      toast.success('Parâmetros salvos com sucesso!')
      refresh()
    } catch {
      toast.error('Erro ao salvar parâmetros.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-slate-200 shadow-2xs">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-bold text-slate-900 flex items-center space-x-2">
          <Settings className="h-4 w-4 text-indigo-600" />
          <span>Parâmetros do Sistema</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4 max-w-lg">
          <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label
                  htmlFor="restringirAcessoRedePmais"
                  className="text-xs font-bold text-slate-800"
                >
                  Restringir acesso à rede da PMais
                </Label>
                <p className="mt-1 text-xs text-slate-600">
                  Fora dessas redes, somente usuários autorizados poderão entrar com código por
                  e-mail.
                </p>
              </div>
              <Switch
                id="restringirAcessoRedePmais"
                checked={restringirAcessoRedePmais}
                onCheckedChange={setRestringirAcessoRedePmais}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="redesPmaisAutorizadas" className="text-xs font-bold text-slate-700">
                Redes públicas da PMais
              </Label>
              <textarea
                id="redesPmaisAutorizadas"
                value={redesPmaisAutorizadas}
                onChange={(event) => setRedesPmaisAutorizadas(event.target.value)}
                className="min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm"
                placeholder="143.208.130.134/32"
              />
              {fieldErrors.redes_autorizadas_pmais && (
                <p className="text-xs text-red-500">{fieldErrors.redes_autorizadas_pmais}</p>
              )}
              <p className="text-xs text-slate-500">Uma rede IPv4 por linha, no formato CIDR.</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">
              Prazo em dias para alerta de Ação Necessária
            </Label>
            <Input
              type="number"
              min={1}
              value={prazoAlertaDias}
              onChange={(e) => setPrazoAlertaDias(e.target.value)}
              required
            />
            <p className="text-xs text-slate-500">
              Vagas abertas há mais dias que este prazo serão marcadas com alerta de "Ação
              Necessária".
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Nome do Remetente</Label>
            <Input
              value={nomeRemetente}
              onChange={(e) => setNomeRemetente(e.target.value)}
              placeholder="Ex: PMais RH"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">E-mail Remetente</Label>
            <Input
              type="email"
              value={emailRemetente}
              onChange={(e) => {
                setEmailRemetente(e.target.value)
                if (fieldErrors.email_remetente) {
                  setFieldErrors((prev) => ({ ...prev, email_remetente: '' }))
                }
              }}
              placeholder="Ex: vagas@pmaisservicos.com.br"
            />
            {fieldErrors.email_remetente && (
              <p className="text-xs text-red-500">{fieldErrors.email_remetente}</p>
            )}
            <p className="text-xs text-slate-500">
              Apenas um e-mail. Não aceita múltiplos destinatários.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Frase slogan da PMais</Label>
            <Input
              value={sloganPmais}
              onChange={(e) => setSloganPmais(e.target.value)}
              placeholder="Ex: PMais — Soluções em Terceirização"
            />
            <p className="text-xs text-slate-500">
              Esta frase será incluída no rodapé dos e-mails enviados aos candidatos.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">E-mail do DP</Label>
            <Input
              value={emailDpLista}
              onChange={(e) => {
                setEmailDpLista(e.target.value)
                if (fieldErrors.email_dp_lista) {
                  setFieldErrors((prev) => ({ ...prev, email_dp_lista: '' }))
                }
              }}
              placeholder="Ex: dp@pmaisservicos.com.br, dp2@pmaisservicos.com.br"
            />
            {fieldErrors.email_dp_lista && (
              <p className="text-xs text-red-500">{fieldErrors.email_dp_lista}</p>
            )}
            <p className="text-xs text-slate-500">
              E-mails separados por vírgula. O primeiro será destinatário principal e os demais em
              cópia.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">E-mail do Operacional</Label>
            <Input
              value={emailOperacionalLista}
              onChange={(e) => {
                setEmailOperacionalLista(e.target.value)
                if (fieldErrors.email_operacional_lista) {
                  setFieldErrors((prev) => ({ ...prev, email_operacional_lista: '' }))
                }
              }}
              placeholder="Ex: operacional@pmaisservicos.com.br"
            />
            {fieldErrors.email_operacional_lista && (
              <p className="text-xs text-red-500">{fieldErrors.email_operacional_lista}</p>
            )}
            <p className="text-xs text-slate-500">
              E-mails separados por vírgula. O primeiro será destinatário principal e os demais em
              cópia.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">E-mail do comercial</Label>
            <Input
              value={emailComercial}
              onChange={(e) => {
                setEmailComercial(e.target.value)
                if (fieldErrors.email_comercial) {
                  setFieldErrors((prev) => ({ ...prev, email_comercial: '' }))
                }
              }}
              placeholder="Ex: comercial@pmaisservicos.com.br"
            />
            {fieldErrors.email_comercial && (
              <p className="text-xs text-red-500">{fieldErrors.email_comercial}</p>
            )}
            <p className="text-xs text-slate-500">
              E-mails separados por vírgula. O primeiro será destinatário principal e os demais em
              cópia.
            </p>
          </div>

          <Button
            type="submit"
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            <Save className="h-4 w-4 mr-1.5" />
            {saving ? 'Salvando...' : 'Salvar Parâmetros'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
