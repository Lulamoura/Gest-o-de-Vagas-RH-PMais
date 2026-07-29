import { useState, useEffect } from 'react'
import { getEmailTemplates, updateEmailTemplate } from '@/services/email_templates'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { EmailTemplateRecord } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Mail, Pencil, Lock } from 'lucide-react'

const TYPE_LABELS: Record<string, string> = {
  complement_data: 'Solicitar Dados Complementares',
  disqualification: 'Aviso de Desclassificação',
}

const PLACEHOLDERS = [
  { token: '{candidate_name}', description: 'Nome do candidato' },
  { token: '{vacancy_name}', description: 'Nome da vaga (cargo)' },
  { token: '{company_name}', description: 'Sempre "PMais Terceirização"' },
  { token: '{public_url}', description: 'Link do formulário (apenas dados complementares)' },
]

export default function EmailTemplates() {
  const { isAdmin, isSuperAdmin } = useAuth()
  const [templates, setTemplates] = useState<EmailTemplateRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplateRecord | null>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    try {
      const data = await getEmailTemplates()
      setTemplates(data)
    } catch {
      toast.error('Erro ao carregar modelos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin || isSuperAdmin) loadData()
  }, [isAdmin, isSuperAdmin])

  useRealtime('email_templates', () => {
    loadData()
  })

  if (!isAdmin && !isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
        <div className="p-4 bg-rose-100 text-rose-600 rounded-full">
          <Lock className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Acesso Restrito</h2>
        <p className="text-sm text-slate-500 max-w-md">
          Apenas administradores podem gerenciar os modelos de e-mail.
        </p>
      </div>
    )
  }

  const openEdit = (template: EmailTemplateRecord) => {
    setEditingTemplate(template)
    setSubject(template.subject)
    setBody(template.body)
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTemplate) return
    if (!subject.trim() || !body.trim()) {
      toast.error('Assunto e corpo do e-mail são obrigatórios')
      return
    }
    setSaving(true)
    try {
      await updateEmailTemplate(editingTemplate.id, { subject, body })
      toast.success('Modelo salvo com sucesso')
      setModalOpen(false)
      loadData()
    } catch {
      toast.error('Erro ao salvar modelo')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
          <Mail className="h-5 w-5 text-indigo-600" />
          <span>Modelos de E-mail</span>
        </h2>
        <p className="text-xs text-slate-500">
          Personalize os e-mails enviados automaticamente aos candidatos
        </p>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <Card className="border-slate-200">
            <CardContent className="py-8 text-center text-slate-500 text-sm">
              Carregando...
            </CardContent>
          </Card>
        ) : templates.length === 0 ? (
          <Card className="border-slate-200">
            <CardContent className="py-8 text-center text-slate-500 text-sm">
              Nenhum modelo encontrado.
            </CardContent>
          </Card>
        ) : (
          templates.map((template) => (
            <Card key={template.id} className="border-slate-200 shadow-2xs">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="space-y-1 min-w-0 flex-1">
                  <CardTitle className="text-base font-bold text-slate-900">
                    {TYPE_LABELS[template.type] || template.type}
                  </CardTitle>
                  <p className="text-sm text-slate-500 truncate">
                    <strong>Assunto:</strong> {template.subject}
                  </p>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <Badge variant="secondary" className="text-xs">
                    {template.type}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(template)}
                    className="border-slate-300"
                  >
                    <Pencil className="h-4 w-4 mr-1.5" /> Editar
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Editar Modelo —{' '}
              {editingTemplate ? TYPE_LABELS[editingTemplate.type] || editingTemplate.type : ''}
            </DialogTitle>
            <DialogDescription>
              Edite o assunto e o corpo do e-mail. Use variáveis para personalizar.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Tipo</Label>
              <Input
                value={
                  editingTemplate ? TYPE_LABELS[editingTemplate.type] || editingTemplate.type : ''
                }
                disabled
                className="bg-slate-50"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Assunto</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Corpo do e-mail</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                rows={10}
                className="font-mono text-sm"
              />
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
              <p className="text-xs font-bold text-slate-700">Variáveis disponíveis:</p>
              {PLACEHOLDERS.map((p) => (
                <div key={p.token} className="flex items-center space-x-2 text-xs">
                  <code className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded font-mono">
                    {p.token}
                  </code>
                  <span className="text-slate-500">{p.description}</span>
                </div>
              ))}
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
    </div>
  )
}
