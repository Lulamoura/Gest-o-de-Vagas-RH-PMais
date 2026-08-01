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

export function SystemParametersForm() {
  const { parameters, refresh } = useSystemParameters()
  const [prazoAlertaDias, setPrazoAlertaDias] = useState('30')
  const [nomeRemetente, setNomeRemetente] = useState('')
  const [emailRemetente, setEmailRemetente] = useState('')
  const [sloganPmais, setSloganPmais] = useState('')
  const [emailDp, setEmailDp] = useState('')
  const [emailOperacional, setEmailOperacional] = useState('')
  const [saving, setSaving] = useState(false)
  const [recordId, setRecordId] = useState<string | null>(null)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (parameters) {
      setPrazoAlertaDias(String(parameters.prazo_alerta_dias ?? 30))
      setNomeRemetente(parameters.nome_remetente || '')
      setEmailRemetente(parameters.email_remetente || '')
      setSloganPmais(parameters.slogan_pmais || '')
      setEmailDp(parameters.email_dp || '')
      setEmailOperacional(parameters.email_operacional || '')
      setRecordId(parameters.id)
    } else {
      setPrazoAlertaDias('30')
      setNomeRemetente('')
      setEmailRemetente('')
      setSloganPmais('')
      setEmailDp('')
      setEmailOperacional('')
      setRecordId(null)
    }
  }, [parameters])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const dias = parseInt(prazoAlertaDias, 10)
    if (isNaN(dias) || dias <= 0) {
      toast.error('Prazo em dias deve ser um número positivo.')
      return
    }
    setSaving(true)
    try {
      const data = {
        prazo_alerta_dias: dias,
        nome_remetente: nomeRemetente,
        email_remetente: emailRemetente,
        slogan_pmais: sloganPmais,
        email_dp: emailDp,
        email_operacional: emailOperacional,
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
      setEmailDp('')
      setEmailOperacional('')
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
              onChange={(e) => setEmailRemetente(e.target.value)}
              placeholder="Ex: vagas@pmaisservicos.com.br"
            />
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
              type="email"
              value={emailDp}
              onChange={(e) => setEmailDp(e.target.value)}
              placeholder="Ex: dp@pmaisservicos.com.br"
            />
            <p className="text-xs text-slate-500">
              E-mail do time de DP para receber avisos de integração de candidatos.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">E-mail do Operacional</Label>
            <Input
              type="email"
              value={emailOperacional}
              onChange={(e) => setEmailOperacional(e.target.value)}
              placeholder="Ex: operacional@pmaisservicos.com.br"
            />
            <p className="text-xs text-slate-500">
              E-mail do time Operacional para receber avisos de integração de candidatos.
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
