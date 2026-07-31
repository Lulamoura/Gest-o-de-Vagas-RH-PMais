import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { updateEmailTemplate, sendTestEmail } from '@/services/email_templates'
import { EmailTemplateRecord } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { RichTextEditor } from '@/components/RichTextEditor'
import { toast } from 'sonner'
import { Send, Save, Eye } from 'lucide-react'

const TYPE_LABELS: Record<string, string> = {
  complement_data: 'Solicitar Dados Complementares',
  disqualification: 'Aviso de Desclassificação',
  encaminhamento_exames: 'Encaminhamento para Exames',
}

const PLACEHOLDERS = [
  { token: '{candidate_name}', description: 'Nome do candidato' },
  { token: '{vacancy_name}', description: 'Nome da vaga (cargo)' },
  { token: '{company_name}', description: 'Sempre "PMais Terceirização"' },
  { token: '{public_url}', description: 'Link do formulário (apenas dados complementares)' },
  { token: '{clinica_nome}', description: 'Nome da clínica' },
  { token: '{clinica_endereco}', description: 'Endereço da clínica' },
  { token: '{clinica_telefone}', description: 'Telefone da clínica' },
  { token: '{clinica_email}', description: 'E-mail da clínica' },
  { token: '{clinica_contato}', description: 'Pessoa de contato da clínica' },
  { token: '{comentario}', description: 'Comentário/instruções do RH' },
]

const SAMPLE_DATA = {
  candidate_name: 'Maria Silva',
  vacancy_name: 'Auxiliar de Limpeza',
  company_name: 'PMais Terceirização',
  public_url: 'https://vagaspmais.pmaisservicos.com.br/candidato/example/preencher',
  clinica_nome: 'Clínica Santa Saúde',
  clinica_endereco: 'Rua das Flores, 123 - Centro',
  clinica_telefone: '(11) 3333-4444',
  clinica_email: 'contato@clinicasantasaude.com.br',
  clinica_contato: 'Dra. Ana Paula',
  comentario: 'Realizar exames de sangue e raios-X, comparecer em jejum.',
}

function renderPreview(text: string): string {
  if (!text) return ''
  return text
    .replace(/\{candidate_name\}/g, SAMPLE_DATA.candidate_name)
    .replace(/\{vacancy_name\}/g, SAMPLE_DATA.vacancy_name)
    .replace(/\{company_name\}/g, SAMPLE_DATA.company_name)
    .replace(/\{public_url\}/g, SAMPLE_DATA.public_url)
    .replace(/\{clinica_nome\}/g, SAMPLE_DATA.clinica_nome)
    .replace(/\{clinica_endereco\}/g, SAMPLE_DATA.clinica_endereco)
    .replace(/\{clinica_telefone\}/g, SAMPLE_DATA.clinica_telefone)
    .replace(/\{clinica_email\}/g, SAMPLE_DATA.clinica_email)
    .replace(/\{clinica_contato\}/g, SAMPLE_DATA.clinica_contato)
    .replace(/\{comentario\}/g, SAMPLE_DATA.comentario)
}

interface EmailTemplateEditorDialogProps {
  template: EmailTemplateRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function EmailTemplateEditorDialog({
  template,
  open,
  onOpenChange,
  onSaved,
}: EmailTemplateEditorDialogProps) {
  const { user } = useAuth()
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)
  const [testEmail, setTestEmail] = useState('')

  useEffect(() => {
    if (template) {
      setSubject(template.subject)
      setBody(template.body)
      setTestEmail(user?.email || '')
    }
  }, [template, user])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!template) return
    if (!subject.trim() || !body.trim()) {
      toast.error('Assunto e corpo do e-mail são obrigatórios')
      return
    }
    setSaving(true)
    try {
      await updateEmailTemplate(template.id, { subject, body })
      toast.success('Modelo salvo com sucesso')
      onOpenChange(false)
      onSaved()
    } catch {
      toast.error('Erro ao salvar modelo')
    } finally {
      setSaving(false)
    }
  }

  const handleTestSend = async () => {
    if (!template) return
    if (!subject.trim() || !body.trim()) {
      toast.error('Preencha o assunto e o corpo do e-mail antes de testar')
      return
    }
    setSendingTest(true)
    try {
      await sendTestEmail({
        type: template.type,
        subject,
        body,
        test_email: testEmail.trim() || undefined,
      })
      toast.success('E-mail de teste enviado com sucesso')
    } catch (err: any) {
      const detail =
        err?.response?.error || err?.response?.details || err?.message || 'Erro desconhecido'
      toast.error(`Falha ao enviar e-mail de teste: ${detail}`)
    } finally {
      setSendingTest(false)
    }
  }

  if (!template) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Modelo — {TYPE_LABELS[template.type] || template.type}</DialogTitle>
          <DialogDescription>
            Edite o assunto e o corpo do e-mail. Use o editor rico e insira variáveis.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Tipo</Label>
            <Input
              value={TYPE_LABELS[template.type] || template.type}
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
            <RichTextEditor value={body} onChange={setBody} placeholders={PLACEHOLDERS} />
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
          <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-2">
            <div className="flex items-center space-x-2">
              <Eye className="h-4 w-4 text-slate-400" />
              <p className="text-xs font-bold text-slate-700">Pré-visualização</p>
            </div>
            <p className="text-sm font-semibold text-slate-900">
              {renderPreview(subject) || '(assunto vazio)'}
            </p>
            <div
              className="prose prose-sm max-w-none text-slate-700 [&_a]:text-indigo-600 [&_a]:underline"
              dangerouslySetInnerHTML={{
                __html: renderPreview(body) || '<p class="text-slate-400">(corpo vazio)</p>',
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">
              E-mail para teste (deixe vazio para usar seu e-mail)
            </Label>
            <Input
              type="email"
              placeholder={user?.email || 'seu@email.com'}
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
            />
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleTestSend}
              disabled={sendingTest}
              className="border-slate-300"
            >
              <Send className="h-4 w-4 mr-1.5" />
              {sendingTest ? 'Enviando...' : 'Enviar Teste'}
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              <Save className="h-4 w-4 mr-1.5" />
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
