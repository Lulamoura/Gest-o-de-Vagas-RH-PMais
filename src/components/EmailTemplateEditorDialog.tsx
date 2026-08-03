import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { EmailTemplateRecord, EmailType } from '@/types'
import { updateEmailTemplate } from '@/services/email_templates'
import { RichTextEditor } from '@/components/RichTextEditor'
import { toast } from 'sonner'

interface EmailTemplateEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: EmailTemplateRecord | null
  onSaved: () => void
}

const VARIABLES_BY_TYPE: Record<EmailType, { key: string; label: string }[]> = {
  complement_data: [
    { key: 'nome', label: '{{nome}}' },
    { key: 'vaga', label: '{{vaga}}' },
    { key: 'link_formulario', label: '{{link_formulario}}' },
    { key: 'company_name', label: '{{company_name}}' },
  ],
  disqualification: [
    { key: 'nome', label: '{{nome}}' },
    { key: 'vaga', label: '{{vaga}}' },
    { key: 'company_name', label: '{{company_name}}' },
  ],
  encaminhamento_exames: [
    { key: 'nome', label: '{{nome}}' },
    { key: 'vaga', label: '{{vaga}}' },
    { key: 'clinica_nome', label: '{{clinica_nome}}' },
    { key: 'clinica_endereco', label: '{{clinica_endereco}}' },
    { key: 'clinica_telefone', label: '{{clinica_telefone}}' },
    { key: 'clinica_email', label: '{{clinica_email}}' },
    { key: 'clinica_contato', label: '{{clinica_contato}}' },
    { key: 'comentario', label: '{{comentario}}' },
    { key: 'company_name', label: '{{company_name}}' },
  ],
}

export function EmailTemplateEditorDialog({
  open,
  onOpenChange,
  template,
  onSaved,
}: EmailTemplateEditorDialogProps) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (template) {
      setSubject(template.subject || '')
      setBody(template.body || '')
    }
  }, [template])

  const handleSave = async () => {
    if (!template) return
    if (!subject.trim()) {
      toast.error('O assunto é obrigatório.')
      return
    }
    if (!body.trim()) {
      toast.error('O corpo do e-mail é obrigatório.')
      return
    }

    setSaving(true)
    try {
      await updateEmailTemplate(template.id, { subject, body })
      toast.success('Modelo de e-mail atualizado com sucesso!')
      onOpenChange(false)
      onSaved()
    } catch {
      toast.error('Erro ao atualizar modelo de e-mail.')
    } finally {
      setSaving(false)
    }
  }

  const vars = template ? VARIABLES_BY_TYPE[template.type] || [] : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Modelo de E-mail</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">
              Assunto <span className="text-rose-500">*</span>
            </Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Digite o assunto do e-mail"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">
              Corpo do E-mail (HTML Formatado) <span className="text-rose-500">*</span>
            </Label>
            <RichTextEditor value={body} onChange={setBody} availableVariables={vars} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            {saving ? 'Salvando...' : 'Salvar Modelo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
