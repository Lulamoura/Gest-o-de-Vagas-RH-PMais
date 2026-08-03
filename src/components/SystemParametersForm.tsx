import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  createSystemParameters,
  updateSystemParameters,
  deleteSystemParameters,
} from '@/services/system_parameters'
import { useSystemParameters } from '@/hooks/use-system-parameters'
import { toast } from 'sonner'
import { Save, Trash2, Settings } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
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

export function SystemParametersForm() {
  const { parameters, refresh } = useSystemParameters()
  const [prazoAlertaDias, setPrazoAlertaDias] = useState('30')
  const [nomeRemetente, setNomeRemetente] = useState('')
  const [emailRemetente, setEmailRemetente] = useState('')
  const [sloganPmais, setSloganPmais] = useState('')
  const [emailDpLista, setEmailDpLista] = useState('')
  const [emailOperacionalLista, setEmailOperacionalLista] = useState('')
  const [emailComercial, setEmailComercial] = useState('')
  const [saving, setSaving] = useState(false)
  const [recordId, setRecordId] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
      setRecordId(parameters.id)
    } else {
      setPrazoAlertaDias('30')
      setNomeRemetente('')
      setEmailRemetente('')
      setSloganPmais('')
      setEmailDpLista('')
      setEmailOperacionalLista('')
      setEmailComercial('')
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
      const data = {
        prazo_alerta_dias: dias,
        nome_remetente: nomeRemetente,
        email_remetente: emailRemetente,
        slogan_pmais: sloganPmais,
        email_dp_lista: emailDpLista,
        email_operacional_lista: emailOperacionalLista,
        email_comercial: emailComercial,
      }
      if (recordId) {
        await updateSystemParameters(recordId, data)
      } else {
        await createSystemParameters(data)
      }
      toast.success('Parâmetros salvos com sucesso!')
      refresh()
    } catch {
      toast.error('Erro ao salvar parâmetros.')
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!recordId) return
    setDeleting(true)
    try {
      await deleteSystemParameters(recordId)
      setRecordId(null)
      setPrazoAlertaDias('30')
      setNomeRemetente('')
      setEmailRemetente('')
      setSloganPmais('')
      setEmailDpLista('')
      setEmailOperacionalLista('')
      setEmailComercial('')
      toast.success('Parâmetros excluídos com sucesso.')
      setDeleteDialogOpen(false)
      refresh()
    } catch {
      toast.error('Erro ao excluir parâmetros.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card className="border-slate-200 shadow-2xs">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-bold text-slate-900 flex items-center space-x-2">
          <Settings className="h-4 w-4 text-indigo-600" />
          <span>Parâmetros do Sistema</span>
        </CardTitle>
        {recordId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            className="text-rose-600 hover:text-rose-700"
          >
            <Trash2 className="h-4 w-4 mr-1" /> Excluir
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4 max-w-lg">
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

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Confirmação de Exclusão"
        description="Excluir parâmetros do sistema? Os valores padrão serão restaurados."
        confirmText="Confirmar"
        cancelText="Cancelar"
        variant="destructive"
        loading={deleting}
        onConfirm={handleConfirmDelete}
      />
    </Card>
  )
}
