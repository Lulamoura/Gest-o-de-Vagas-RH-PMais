import { useState, useEffect } from 'react'
import { getEmailTemplates } from '@/services/email_templates'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { EmailTemplateRecord } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmailTemplateEditorDialog } from '@/components/EmailTemplateEditorDialog'
import { toast } from 'sonner'
import { Mail, Pencil, Lock } from 'lucide-react'

const TYPE_LABELS: Record<string, string> = {
  complement_data: 'Solicitar Dados Complementares',
  disqualification: 'Aviso de Desclassificação',
  encaminhamento_exames: 'Encaminhamento para Exames',
}

export default function EmailTemplates() {
  const { isAdmin, isSuperAdmin } = useAuth()
  const [templates, setTemplates] = useState<EmailTemplateRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplateRecord | null>(null)

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
    setModalOpen(true)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
          <Mail className="h-5 w-5 text-indigo-600" />
          <span>Modelos de E-mail</span>
        </h2>
        <p className="text-xs text-slate-500">
          Personalize os e-mails enviados automaticamente aos candidatos com editor visual
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
                    <strong>Assunto:</strong>{' '}
                    <span
                      className="text-slate-600"
                      dangerouslySetInnerHTML={{ __html: template.subject }}
                    />
                  </p>
                  <div
                    className="text-xs text-slate-400 truncate prose prose-xs max-w-none [&_a]:text-indigo-600"
                    dangerouslySetInnerHTML={{ __html: template.body }}
                  />
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

      <EmailTemplateEditorDialog
        template={editingTemplate}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSaved={loadData}
      />
    </div>
  )
}
