import { useState, useEffect, useRef } from 'react'
import {
  getRequisitionAttachments,
  createRequisitionAttachment,
  deleteRequisitionAttachment,
} from '@/services/requisition_attachments'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatDateBR } from '@/lib/status-utils'
import { Loader2, Upload, Trash2, FileText, Download } from 'lucide-react'
import { toast } from 'sonner'
import pb from '@/lib/pocketbase/client'
import type { RequisitionAttachmentRecord } from '@/types'

export function RequisitionAttachments({
  requisitionId,
  userId,
}: {
  requisitionId: string
  userId: string
}) {
  const { user } = useAuth()
  const [attachments, setAttachments] = useState<RequisitionAttachmentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadData = async () => {
    try {
      setAttachments(await getRequisitionAttachments(requisitionId))
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [requisitionId])
  useRealtime('requisition_attachments', () => loadData())

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máx. 10MB)')
      return
    }
    setUploading(true)
    try {
      await createRequisitionAttachment(requisitionId, file, userId)
      toast.success('Arquivo anexado!')
      loadData()
    } catch {
      toast.error('Erro ao anexar arquivo')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleDelete = async (attachmentId: string) => {
    try {
      await deleteRequisitionAttachment(attachmentId)
      loadData()
    } catch {
      toast.error('Erro ao excluir anexo')
    }
  }

  const canDelete = (a: RequisitionAttachmentRecord) =>
    a.uploaded_by === userId || user?.profile === 'admin' || user?.profile === 'superadmin'

  if (loading)
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex justify-end">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={handleUpload}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Anexar Arquivo
          </Button>
        </div>
        {attachments.length === 0 ? (
          <p className="text-center text-muted-foreground py-4 text-sm">Nenhum anexo.</p>
        ) : (
          <div className="space-y-2">
            {attachments.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-lg border p-3">
                <FileText className="h-5 w-5 text-indigo-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.nome_arquivo || 'Arquivo'}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.expand?.uploaded_by?.name || ''} — {a.created ? formatDateBR(a.created) : ''}
                  </p>
                </div>
                <a
                  href={pb.files.getUrl(a, a.arquivo) as string}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Download className="h-4 w-4" />
                  </Button>
                </a>
                {canDelete(a) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDelete(a.id)}
                  >
                    <Trash2 className="h-4 w-4 text-rose-500" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
