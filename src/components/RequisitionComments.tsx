import { useState, useEffect } from 'react'
import {
  getRequisitionComments,
  createRequisitionComment,
  deleteRequisitionComment,
} from '@/services/requisition_comments'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { formatDateBR } from '@/lib/status-utils'
import { Loader2, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { RequisitionCommentRecord } from '@/types'

export function RequisitionComments({
  requisitionId,
  userId,
}: {
  requisitionId: string
  userId: string
}) {
  const { user } = useAuth()
  const [comments, setComments] = useState<RequisitionCommentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    try {
      setComments(await getRequisitionComments(requisitionId))
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [requisitionId])
  useRealtime('requisition_comments', () => loadData())

  const handleSend = async () => {
    if (!text.trim() || !userId) return
    setSaving(true)
    try {
      await createRequisitionComment({
        requisition_id: requisitionId,
        usuario_id: userId,
        comentario: text.trim(),
      })
      setText('')
      loadData()
    } catch {
      toast.error('Erro ao enviar comentário')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    try {
      await deleteRequisitionComment(commentId)
      loadData()
    } catch {
      toast.error('Erro ao excluir comentário')
    }
  }

  const canDelete = (c: RequisitionCommentRecord) =>
    c.usuario_id === userId || user?.profile === 'admin' || user?.profile === 'superadmin'

  if (loading)
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="space-y-3">
          {comments.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm">
              Nenhum comentário ainda.
            </p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="group">
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {c.expand?.usuario_id?.name || 'Usuário'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {c.created ? formatDateBR(c.created) : ''}
                      </span>
                      {canDelete(c) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={() => handleDelete(c.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{c.comentario}</p>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escreva um comentário..."
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend()
            }}
          />
          <Button disabled={saving || !text.trim()} onClick={handleSend} className="self-end">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
