import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Loader2,
  ArrowLeft,
  Pencil,
  Copy,
  CheckCircle2,
  XCircle,
  Eye,
  Ban,
  Send,
  Globe,
  Edit3,
  Trash2,
  ExternalLink,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { ChangeRequestDialog } from '@/components/ChangeRequestDialog'
import { RequisitionChangeRequests } from '@/components/RequisitionChangeRequests'
import { getPriorityBadgeClass, formatDateBR } from '@/lib/status-utils'
import {
  getRequisition,
  changeRequisitionStatus,
  deleteRequisition,
  createWordpressDraft,
  updateRequisition,
} from '@/services/requisitions'
import { getChangeRequests } from '@/services/requisition_change_requests'
import { RequisitionHistory } from '@/components/RequisitionHistory'
import { RequisitionComments } from '@/components/RequisitionComments'
import { RequisitionAttachments } from '@/components/RequisitionAttachments'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import {
  REQUISITION_STATUS_BADGE,
  REQUISITION_STATUS_LABELS,
  getMissingApprovalFields,
} from '@/lib/requisition-utils'
import type { RequisitionRecord } from '@/types'
import { cn } from '@/lib/utils'

export default function RequisitionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [req, setReq] = useState<RequisitionRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showCancel, setShowCancel] = useState(false)
  const [showChangeRequest, setShowChangeRequest] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [wpLoading, setWpLoading] = useState(false)
  const [wpError, setWpError] = useState<string | null>(null)
  const [hasPendingChangeRequest, setHasPendingChangeRequest] = useState(false)

  const loadReq = useCallback(async () => {
    if (!id) return
    try {
      const data = await getRequisition(id)
      setReq(data)
      if (data.wordpress_sync_status === 'erro') {
        setWpError(data.wordpress_error_message || 'Erro ao criar rascunho no WordPress')
      } else {
        setWpError(null)
      }
    } catch {
      navigate('/requisicoes')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => {
    loadReq()
  }, [loadReq])
  useRealtime('requisitions', () => {
    loadReq()
  })

  const loadChangeRequests = useCallback(async () => {
    if (!id) return
    try {
      const requests = await getChangeRequests(id)
      setHasPendingChangeRequest(requests.some((r) => r.status === 'Pendente'))
    } catch {
      /* ignore */
    }
  }, [id])

  useEffect(() => {
    loadChangeRequests()
  }, [loadChangeRequests])
  useRealtime('requisition_change_requests', () => {
    loadChangeRequests()
  })

  if (loading)
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  if (!req) return null

  const isSolicitante = user?.id === req.solicitante
  const isAdmin = user?.profile === 'admin' || user?.profile === 'superadmin'
  const isRH = user?.expand?.departamento?.nome === 'rh'
  const canManage = isAdmin || isRH
  const missingApprovalFields = getMissingApprovalFields(req)
  const canSubmitForApproval = missingApprovalFields.length === 0
  const canEdit =
    (req.status === 'Rascunho' && (isSolicitante || isAdmin)) ||
    (req.edicao_liberada && isSolicitante)
  const canCreate = ['operator', 'admin', 'superadmin'].includes(user?.profile || '')
  const canDeleteReq = user?.profile === 'superadmin'

  const handleDelete = async () => {
    if (!id) return
    setDeleteLoading(true)
    try {
      await deleteRequisition(id)
      toast.success('Requisição excluída com sucesso!')
      navigate('/requisicoes')
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao excluir requisição')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleChange = async (status: string, obs?: string) => {
    if (!id) return
    setActionLoading(true)
    try {
      await changeRequisitionStatus(id, status, obs)
      toast.success('Status atualizado!')
      loadReq()
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao atualizar status')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCreateWordpressDraft = async () => {
    if (!id) return
    setWpLoading(true)
    setWpError(null)
    try {
      await createWordpressDraft(id)
      toast.success('Rascunho criado no WordPress!')
      loadReq()
    } catch (err: any) {
      setWpError(err?.message || 'Erro ao criar rascunho no WordPress')
      loadReq()
    } finally {
      setWpLoading(false)
    }
  }

  const handleFinishEditing = async () => {
    if (!id) return
    try {
      await updateRequisition(id, { edicao_liberada: false })
      toast.success('Edição finalizada!')
      loadReq()
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao finalizar edição')
    }
  }

  const REQUIRED_LABELS = new Set([
    'Número da OE',
    'Departamento',
    'Cliente',
    'Cargo',
    'Cidade',
    'Tipo de Vaga',
    'Tipo de Contrato',
    'Qtd. Vagas',
    'Prazo',
    'Prioridade',
    'Faixa Salarial',
  ])

  const fields: [string, string | undefined][] = [
    ['Número da OE', req.numero_oe],
    ['Departamento', req.expand?.departamento?.nome],
    ['Cliente', req.expand?.cliente?.nome],
    ['Cargo', req.expand?.cargo?.nome],
    ['Cidade', req.expand?.cidade?.nome],
    ['Tipo de Vaga', req.expand?.tipo_vaga?.nome],
    ['Tipo de Contrato', req.expand?.tipo_contrato?.nome],
    ['Qtd. Vagas', String(req.quantidade_vagas || 0)],
    ['Prazo', req.prazo_desejado ? formatDateBR(req.prazo_desejado) : undefined],
    ['Prioridade', req.prioridade],
    ['Faixa Salarial', req.faixa_salarial],
    ['Solicitante', req.expand?.solicitante?.name],
    ['Criado em', req.created ? formatDateBR(req.created) : undefined],
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/requisicoes')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {req.expand?.cliente?.nome || 'Requisição'} — {req.expand?.cargo?.nome || 'Cargo'}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={REQUISITION_STATUS_BADGE[req.status]}>
                {REQUISITION_STATUS_LABELS[req.status]}
              </Badge>
              {req.prioridade && (
                <Badge className={getPriorityBadgeClass(req.prioridade)}>{req.prioridade}</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {canEdit && (
            <Button variant="outline" onClick={() => navigate(`/requisicoes/${req.id}/editar`)}>
              <Pencil className="h-4 w-4 mr-2" /> Editar
            </Button>
          )}
          {req.edicao_liberada && isSolicitante && (
            <Button
              variant="outline"
              onClick={handleFinishEditing}
              className="text-green-600 border-green-300 hover:bg-green-50"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" /> Finalizar Edição
            </Button>
          )}
          {canCreate && (
            <Button
              variant="outline"
              onClick={() => navigate(`/requisicoes/nova?duplicate=${req.id}`)}
            >
              <Copy className="h-4 w-4 mr-2" /> Duplicar
            </Button>
          )}
          {req.status === 'Aprovada' && canManage && (
            <Button variant="outline" disabled={wpLoading} onClick={handleCreateWordpressDraft}>
              {wpLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Globe className="h-4 w-4 mr-2" />
              )}
              Criar Vaga no WordPress
            </Button>
          )}
          {req.status === 'Rascunho criado no WordPress' && req.wordpress_admin_url && (
            <a href={req.wordpress_admin_url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline">
                <ExternalLink className="h-4 w-4 mr-2" /> Abrir rascunho no WordPress
              </Button>
            </a>
          )}
          {req.status === 'Aprovada' &&
            (isSolicitante || canManage) &&
            !hasPendingChangeRequest &&
            !req.edicao_liberada && (
              <Button variant="outline" onClick={() => setShowChangeRequest(true)}>
                <Edit3 className="h-4 w-4 mr-2" /> Solicitar Alteração
              </Button>
            )}
          {canDeleteReq && (
            <Button
              variant="outline"
              onClick={() => setShowDelete(true)}
              className="text-rose-600 border-rose-300 hover:bg-rose-50"
            >
              <Trash2 className="h-4 w-4 mr-2" /> Excluir
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {req.status === 'Rascunho' && isSolicitante && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  disabled={actionLoading || !canSubmitForApproval}
                  onClick={() => handleChange('Aguardando aprovação')}
                >
                  <Send className="h-4 w-4 mr-2" /> Enviar para Aprovação
                </Button>
              </span>
            </TooltipTrigger>
            {!canSubmitForApproval && (
              <TooltipContent>
                Campos obrigatórios pendentes: {missingApprovalFields.join(', ')}
              </TooltipContent>
            )}
          </Tooltip>
        )}
        {(req.status === 'Rascunho' || req.status === 'Aguardando aprovação') && isSolicitante && (
          <Button variant="outline" disabled={actionLoading} onClick={() => setShowCancel(true)}>
            <Ban className="h-4 w-4 mr-2" /> Cancelar
          </Button>
        )}
        {canManage && req.status === 'Aguardando aprovação' && (
          <Button
            variant="outline"
            disabled={actionLoading}
            onClick={() => handleChange('Em análise')}
          >
            <Eye className="h-4 w-4 mr-2" /> Em Análise
          </Button>
        )}
        {canManage && (req.status === 'Aguardando aprovação' || req.status === 'Em análise') && (
          <>
            <Button
              disabled={actionLoading}
              onClick={() => handleChange('Aprovada')}
              className="bg-green-600 hover:bg-green-500 text-white"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" /> Aprovar
            </Button>
            <Button
              variant="outline"
              disabled={actionLoading}
              onClick={() => setShowReject(true)}
              className="text-rose-600 border-rose-300 hover:bg-rose-50"
            >
              <XCircle className="h-4 w-4 mr-2" /> Reprovar
            </Button>
          </>
        )}
      </div>

      {wpError && req.status === 'Aprovada' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao criar rascunho no WordPress</AlertTitle>
          <AlertDescription>{wpError}</AlertDescription>
        </Alert>
      )}
      {req.status === 'Rascunho criado no WordPress' && req.wordpress_job_id && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            WP #{req.wordpress_job_id}
            {req.wordpress_sync_date && ` • ${formatDateBR(req.wordpress_sync_date)}`}
          </Badge>
        </div>
      )}

      {req.edicao_liberada && isSolicitante && (
        <Alert className="border-green-300 bg-green-50">
          <AlertCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Edição liberada</AlertTitle>
          <AlertDescription className="text-green-700">
            A edição desta requisição foi liberada pelo RH. Clique em &quot;Editar&quot; para
            ajustar os campos necessários. Ao concluir, clique em &quot;Finalizar Edição&quot; para
            encerrar o período de edição.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Detalhes da Requisição</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map(([label, value]) => {
              const isMissing =
                req.status === 'Rascunho' && REQUIRED_LABELS.has(label) && (!value || value === '0')
              return (
                <div key={label} className={cn('border-b pb-2', isMissing && 'border-rose-300')}>
                  <p
                    className={cn(
                      'text-sm',
                      isMissing ? 'text-rose-500 font-medium' : 'text-muted-foreground',
                    )}
                  >
                    {label}
                    {isMissing && ' *'}
                  </p>
                  <p className={cn('font-medium', isMissing && 'text-rose-500')}>
                    {value || (isMissing ? '— Pendente' : '-')}
                  </p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {req.justificativa && (
        <Card>
          <CardHeader>
            <CardTitle>Justificativa</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{req.justificativa}</p>
          </CardContent>
        </Card>
      )}
      {req.especificacoes && (
        <Card>
          <CardHeader>
            <CardTitle>Especificações</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{req.especificacoes}</p>
          </CardContent>
        </Card>
      )}
      {req.observacoes_internas && (
        <Card>
          <CardHeader>
            <CardTitle>Observações Internas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{req.observacoes_internas}</p>
          </CardContent>
        </Card>
      )}
      {req.status === 'Rascunho' && (!req.justificativa || !req.especificacoes) && (
        <Card className="border-rose-200 bg-rose-50/50">
          <CardContent className="pt-6">
            <div className="space-y-1">
              {!req.justificativa && (
                <p className="text-sm text-rose-600 font-medium">
                  • Justificativa é obrigatória para envio à aprovação
                </p>
              )}
              {!req.especificacoes && (
                <p className="text-sm text-rose-600 font-medium">
                  • Especificações são obrigatórias para envio à aprovação
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">Histórico</TabsTrigger>
          <TabsTrigger value="comments">Comentários</TabsTrigger>
          <TabsTrigger value="attachments">Anexos</TabsTrigger>
          <TabsTrigger value="changes">Alterações</TabsTrigger>
        </TabsList>
        <TabsContent value="history">
          <RequisitionHistory requisitionId={req.id} />
        </TabsContent>
        <TabsContent value="comments">
          <RequisitionComments requisitionId={req.id} userId={user?.id || ''} />
        </TabsContent>
        <TabsContent value="attachments">
          <RequisitionAttachments requisitionId={req.id} userId={user?.id || ''} />
        </TabsContent>
        <TabsContent value="changes">
          <RequisitionChangeRequests requisitionId={req.id} />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={showCancel}
        onOpenChange={setShowCancel}
        title="Cancelar Requisição"
        description="Deseja realmente cancelar? Esta ação não pode ser desfeita."
        confirmText="Sim, Cancelar"
        variant="warning"
        loading={actionLoading}
        onConfirm={() => {
          setShowCancel(false)
          handleChange('Cancelada')
        }}
      />

      <Dialog open={showReject} onOpenChange={setShowReject}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reprovar Requisição</DialogTitle>
            <DialogDescription>Informe o motivo da reprovação (opcional)</DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Motivo da reprovação..."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReject(false)}>
              Cancelar
            </Button>
            <Button
              disabled={actionLoading}
              onClick={() => {
                setShowReject(false)
                handleChange('Reprovada', rejectReason)
                setRejectReason('')
              }}
              className="bg-rose-600 hover:bg-rose-500 text-white"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reprovar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ChangeRequestDialog
        open={showChangeRequest}
        onOpenChange={setShowChangeRequest}
        requisitionId={req.id}
        solicitanteId={user?.id || ''}
      />

      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Excluir Requisição"
        description="Deseja realmente excluir esta requisição? Esta ação não pode ser desfeita e todos os registros relacionados (histórico, comentários, anexos, notificações) serão removidos."
        confirmText="Sim, Excluir"
        cancelText="Cancelar"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={handleDelete}
      />
    </div>
  )
}
