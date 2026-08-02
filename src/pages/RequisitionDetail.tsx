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
import { ChangeRequestDialog } from '@/components/ChangeRequestDialog'
import { RequisitionChangeRequests } from '@/components/RequisitionChangeRequests'
import { getPriorityBadgeClass, formatDateBR } from '@/lib/status-utils'
import { getRequisition, changeRequisitionStatus } from '@/services/requisitions'
import { RequisitionHistory } from '@/components/RequisitionHistory'
import { RequisitionComments } from '@/components/RequisitionComments'
import { RequisitionAttachments } from '@/components/RequisitionAttachments'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { REQUISITION_STATUS_BADGE, REQUISITION_STATUS_LABELS } from '@/lib/requisition-utils'
import type { RequisitionRecord } from '@/types'

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

  const loadReq = useCallback(async () => {
    if (!id) return
    try {
      setReq(await getRequisition(id))
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

  if (loading)
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  if (!req) return null

  const isSolicitante = user?.id === req.solicitante
  const isAdmin = user?.profile === 'admin' || user?.profile === 'superadmin'
  const isRH = user?.departamento === 'rh'
  const canManage = isAdmin || isRH
  const canEdit = req.status === 'Rascunho' && (isSolicitante || isAdmin)
  const canCreate = ['operator', 'admin', 'superadmin'].includes(user?.profile || '')

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

  const fields: [string, string | undefined][] = [
    ['Número da OE', req.numero_oe],
    ['Departamento', req.departamento],
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
          {canCreate && (
            <Button
              variant="outline"
              onClick={() => navigate(`/requisicoes/nova?duplicate=${req.id}`)}
            >
              <Copy className="h-4 w-4 mr-2" /> Duplicar
            </Button>
          )}
          {req.status === 'Aprovada' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button disabled variant="outline">
                    <Globe className="h-4 w-4 mr-2" /> Criar Vaga no WordPress
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                O endpoint do WordPress requer configuração antes de esta ação estar disponível.
              </TooltipContent>
            </Tooltip>
          )}
          {req.status === 'Aprovada' && (isSolicitante || canManage) && (
            <Button variant="outline" onClick={() => setShowChangeRequest(true)}>
              <Edit3 className="h-4 w-4 mr-2" /> Solicitar Alteração
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {req.status === 'Rascunho' && isSolicitante && (
          <Button disabled={actionLoading} onClick={() => handleChange('Aguardando aprovação')}>
            <Send className="h-4 w-4 mr-2" /> Enviar para Aprovação
          </Button>
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

      <Card>
        <CardHeader>
          <CardTitle>Detalhes da Requisição</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map(([label, value]) => (
              <div key={label} className="border-b pb-2">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="font-medium">{value || '-'}</p>
              </div>
            ))}
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
    </div>
  )
}
