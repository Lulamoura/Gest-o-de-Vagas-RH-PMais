import { useState, useEffect, useCallback, useRef } from 'react'
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
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
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
import { RichTextEditor } from '@/components/RichTextEditor'
import { RequisitionChangeRequests } from '@/components/RequisitionChangeRequests'
import { getPriorityBadgeClass, formatDateBR } from '@/lib/status-utils'
import {
  getRequisition,
  changeRequisitionStatus,
  deleteRequisition,
  createWordpressDraft,
  createManualContingencyWordpressDraft,
  getIrisOperationalStatus,
  updateRequisition,
  suggestRequisitionJobDescription,
  type IrisJobDescriptionSuggestion,
  type IrisOperationalStatus,
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
import { sanitizeIrisPublicHtml } from '@/lib/iris-public-html'
import { isRhDepartmentName } from '@/lib/auth'
import {
  buildIrisReviewedPublication,
  canRequestIrisSuggestion,
  canUseManualContingency,
  getIrisOperationalStatusView,
  reconcileIrisUnavailableAlert,
  refreshIrisStatusAfterUnavailableSuggestionError,
  shouldLoadIrisOperationalStatus,
} from '@/lib/iris-operational-status'

const IRIS_REVIEW_LIMITS = {
  title: 160,
  publicText: 10000,
  internalProfile: 8000,
} as const

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
  const [irisLoading, setIrisLoading] = useState(false)
  const [irisSuggestion, setIrisSuggestion] = useState<IrisJobDescriptionSuggestion | null>(null)
  const [irisTitle, setIrisTitle] = useState('')
  const [irisText, setIrisText] = useState('')
  const [irisInternalProfile, setIrisInternalProfile] = useState('')
  const [showIrisSuggestion, setShowIrisSuggestion] = useState(false)
  const [irisOperationalStatus, setIrisOperationalStatus] = useState<IrisOperationalStatus | null>(
    null,
  )
  const [irisStatusLoading, setIrisStatusLoading] = useState(false)
  const [irisUnavailableAlert, setIrisUnavailableAlert] = useState(false)
  const irisStatusRequestId = useRef(0)
  const [showManualContingency, setShowManualContingency] = useState(false)
  const [manualTitle, setManualTitle] = useState('')
  const [manualPublicDescription, setManualPublicDescription] = useState('')
  const [manualInternalProfile, setManualInternalProfile] = useState('')
  const [manualConfirmed, setManualConfirmed] = useState(false)
  const [manualLoading, setManualLoading] = useState(false)
  const [manualError, setManualError] = useState<string | null>(null)
  const [hasPendingChangeRequest, setHasPendingChangeRequest] = useState(false)
  const isSolicitante = user?.id === req?.solicitante
  const isAdmin = user?.profile === 'admin' || user?.profile === 'superadmin'
  const isRH = isRhDepartmentName(user?.expand?.departamento?.nome)
  const canManage = isAdmin || isRH
  const requisitionStatus = req?.status

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

  const refreshIrisOperationalStatus = useCallback(async () => {
    const requestId = ++irisStatusRequestId.current
    setIrisStatusLoading(true)
    try {
      const status = await getIrisOperationalStatus()
      if (requestId === irisStatusRequestId.current) {
        setIrisOperationalStatus(status)
        setIrisUnavailableAlert((current) => reconcileIrisUnavailableAlert(current, status))
        if (status.status !== 'UNAVAILABLE' || !status.manual_contingency_allowed) {
          setShowManualContingency(false)
        }
      }
    } catch {
      if (requestId === irisStatusRequestId.current) {
        setIrisOperationalStatus({
          status: 'UNKNOWN',
          manual_contingency_allowed: false,
          last_successful_check_at: null,
        })
        setShowManualContingency(false)
      }
    } finally {
      if (requestId === irisStatusRequestId.current) setIrisStatusLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!requisitionStatus || !shouldLoadIrisOperationalStatus(requisitionStatus, canManage)) {
      irisStatusRequestId.current += 1
      setIrisOperationalStatus(null)
      setIrisStatusLoading(false)
      setIrisUnavailableAlert(false)
      setShowManualContingency(false)
      return
    }

    void refreshIrisOperationalStatus()
    const refreshInterval = window.setInterval(refreshIrisOperationalStatus, 60_000)
    return () => {
      irisStatusRequestId.current += 1
      window.clearInterval(refreshInterval)
    }
  }, [requisitionStatus, canManage, refreshIrisOperationalStatus])

  if (loading)
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  if (!req) return null

  const missingApprovalFields = getMissingApprovalFields(req)
  const canSubmitForApproval = missingApprovalFields.length === 0
  const canEdit =
    (req.status === 'Rascunho' && (isSolicitante || isAdmin)) ||
    (req.edicao_liberada && isSolicitante)
  const canCreate = ['operator', 'admin', 'superadmin'].includes(user?.profile || '')
  const canDeleteReq = user?.profile === 'superadmin'
  const irisStatusView = irisOperationalStatus
    ? getIrisOperationalStatusView(irisOperationalStatus)
    : null

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
    if (!id || !irisSuggestion) return
    if (
      irisTitle.trim().length > IRIS_REVIEW_LIMITS.title ||
      irisText.trim().length > IRIS_REVIEW_LIMITS.publicText ||
      irisInternalProfile.trim().length > IRIS_REVIEW_LIMITS.internalProfile
    ) {
      setWpError('Revise os limites de caracteres dos três campos antes de confirmar.')
      return
    }
    setWpLoading(true)
    setWpError(null)
    try {
      await createWordpressDraft(
        id,
        buildIrisReviewedPublication({
          title: irisTitle,
          publicDescription: irisText,
          internalProfile: irisInternalProfile,
          suggestionProof: irisSuggestion.suggestion_proof,
        }),
      )
      toast.success('Rascunho criado no WordPress!')
      setShowIrisSuggestion(false)
      loadReq()
    } catch (err: any) {
      setWpError(err?.message || 'Erro ao criar rascunho no WordPress')
    } finally {
      setWpLoading(false)
    }
  }

  const handleSuggestJobDescription = async () => {
    if (!id || !canRequestIrisSuggestion(irisOperationalStatus, irisStatusLoading)) return
    setIrisLoading(true)
    try {
      const suggestion = await suggestRequisitionJobDescription(id)
      setIrisSuggestion(suggestion)
      setIrisTitle(suggestion.titulo_publico)
      setIrisText(sanitizeIrisPublicHtml(suggestion.descricao_publica))
      setIrisInternalProfile(suggestion.perfil_interno_triagem)
      setShowIrisSuggestion(true)
      setIrisUnavailableAlert(false)
      toast.success('Sugestão da Íris gerada para revisão do RH')
    } catch (err: unknown) {
      const refreshed = await refreshIrisStatusAfterUnavailableSuggestionError(
        err,
        refreshIrisOperationalStatus,
      )
      if (refreshed) {
        setIrisUnavailableAlert(true)
      } else {
        toast.error(err instanceof Error ? err.message : 'Erro ao gerar sugestão da Íris')
      }
    } finally {
      setIrisLoading(false)
    }
  }

  const openManualContingency = () => {
    if (!canUseManualContingency(req.status, canManage, irisOperationalStatus)) return
    setManualTitle(req.expand?.cargo?.nome || '')
    setManualPublicDescription(req.especificacoes || '')
    setManualInternalProfile(req.observacoes_internas || '')
    setManualConfirmed(false)
    setManualError(null)
    setShowManualContingency(true)
  }

  const handleManualContingencyDraft = async () => {
    if (
      !id ||
      !manualConfirmed ||
      !canUseManualContingency(req.status, canManage, irisOperationalStatus)
    ) {
      setShowManualContingency(false)
      return
    }
    if (
      !manualTitle.trim() ||
      !manualPublicDescription.trim() ||
      !manualInternalProfile.trim() ||
      manualTitle.length > IRIS_REVIEW_LIMITS.title ||
      manualPublicDescription.length > IRIS_REVIEW_LIMITS.publicText ||
      manualInternalProfile.length > IRIS_REVIEW_LIMITS.internalProfile
    ) {
      setManualError('Revise o preenchimento e os limites dos três campos antes de confirmar.')
      return
    }

    setManualLoading(true)
    setManualError(null)
    setIrisOperationalStatus(null)
    try {
      const freshStatus = await getIrisOperationalStatus()
      setIrisOperationalStatus(freshStatus)
      if (!canUseManualContingency(req.status, canManage, freshStatus)) {
        setShowManualContingency(false)
        toast.error(
          'A contingência manual não está mais autorizada. Atualize a página e tente novamente.',
        )
        return
      }
      await createManualContingencyWordpressDraft(id, {
        titulo_publico: manualTitle,
        descricao_publica: manualPublicDescription,
        perfil_interno_triagem: manualInternalProfile,
        confirmacao_explicita: true,
      })
      toast.success('Rascunho manual criado no WordPress!')
      setShowManualContingency(false)
      loadReq()
    } catch {
      setIrisOperationalStatus({
        status: 'UNKNOWN',
        manual_contingency_allowed: false,
        last_successful_check_at: null,
      })
      setShowManualContingency(false)
      toast.error('Não foi possível confirmar a autorização e criar o rascunho manual.')
    } finally {
      setManualLoading(false)
    }
  }

  const copyIrisSuggestion = async () => {
    if (!irisText) return
    try {
      await navigator.clipboard.writeText(irisText)
      toast.success('Texto copiado')
    } catch {
      toast.error('Não foi possível copiar o texto')
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
            <Button
              variant="outline"
              disabled={
                irisLoading || !canRequestIrisSuggestion(irisOperationalStatus, irisStatusLoading)
              }
              onClick={handleSuggestJobDescription}
            >
              {irisLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Sugerir descrição com Íris
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

      {req.status === 'Aprovada' && canManage && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>
            Estado operacional da Íris:{' '}
            {irisStatusLoading && !irisStatusView
              ? 'Verificando disponibilidade'
              : irisStatusView?.label || 'Estado não confirmado'}
          </AlertTitle>
          <AlertDescription className="space-y-3">
            {irisStatusView?.lastSuccessfulCheckLabel && (
              <p>{irisStatusView.lastSuccessfulCheckLabel}</p>
            )}
            {irisStatusView?.showManualAction && (
              <div className="space-y-2">
                <p>
                  A contingência manual está autorizada pelo sistema. O conteúdo continuará sujeito
                  à revisão do RH e criará somente um rascunho no WordPress.
                </p>
                <Button type="button" variant="outline" onClick={openManualContingency}>
                  Criar rascunho manual em contingência
                </Button>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {irisUnavailableAlert && req.status === 'Aprovada' && canManage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>A Íris não pôde ser acionada</AlertTitle>
          <AlertDescription>
            O estado operacional foi atualizado. A contingência manual aparecerá somente se o
            sistema confirmar a indisponibilidade e autorizar essa operação.
          </AlertDescription>
        </Alert>
      )}

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

      <Dialog open={showIrisSuggestion} onOpenChange={setShowIrisSuggestion}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sugestão da Íris para publicação da vaga</DialogTitle>
            <DialogDescription>
              Rascunho editorial para revisão do RH. A Íris não publica, não aprova e não altera a
              requisição.
            </DialogDescription>
          </DialogHeader>
          {irisSuggestion && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Título público sugerido</p>
                <Textarea
                  value={irisTitle}
                  onChange={(e) => setIrisTitle(e.target.value)}
                  rows={2}
                  placeholder="Título público da vaga..."
                />
                <p
                  className={cn(
                    'text-xs mt-1',
                    irisTitle.trim().length > IRIS_REVIEW_LIMITS.title
                      ? 'text-rose-600'
                      : 'text-muted-foreground',
                  )}
                >
                  {irisTitle.trim().length}/{IRIS_REVIEW_LIMITS.title} caracteres
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Texto para revisão e publicação
                </p>
                <RichTextEditor
                  value={irisText}
                  onChange={setIrisText}
                  placeholder="Texto público da vaga..."
                  showHtmlToggle={false}
                  sanitizeHtml={sanitizeIrisPublicHtml}
                />
                <p
                  className={cn(
                    'text-xs mt-1',
                    irisText.trim().length > IRIS_REVIEW_LIMITS.publicText
                      ? 'text-rose-600'
                      : 'text-muted-foreground',
                  )}
                >
                  {irisText.trim().length}/{IRIS_REVIEW_LIMITS.publicText} caracteres
                </p>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Perfil interno para triagem</p>
                <Textarea
                  value={irisInternalProfile}
                  onChange={(e) => setIrisInternalProfile(e.target.value)}
                  rows={10}
                  className="font-mono text-xs whitespace-pre-wrap"
                  placeholder="Critérios internos, objetivos e verificáveis para análise curricular..."
                />
                <p className="text-xs text-amber-700 mt-1">
                  Campo não público. Ele será salvo separadamente no WordPress e não fará parte da
                  descrição pública da vaga.
                </p>
                <p
                  className={cn(
                    'text-xs mt-1',
                    irisInternalProfile.trim().length > IRIS_REVIEW_LIMITS.internalProfile
                      ? 'text-rose-600'
                      : 'text-muted-foreground',
                  )}
                >
                  {irisInternalProfile.trim().length}/{IRIS_REVIEW_LIMITS.internalProfile}{' '}
                  caracteres
                </p>
              </div>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Revisão humana obrigatória</AlertTitle>
                <AlertDescription>
                  Revise os três campos. Ao confirmar, o sistema criará somente um rascunho no
                  WordPress; nenhuma vaga será publicada automaticamente.
                </AlertDescription>
              </Alert>
              <p className="text-xs text-muted-foreground">
                Conteúdo gerado pelo perfil Hermes da Íris com a base governada de Pessoas. A
                sugestão expira em 15 minutos; se expirar, gere novamente antes de confirmar.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIrisSuggestion(false)}>
              Fechar
            </Button>
            <Button variant="outline" onClick={copyIrisSuggestion} disabled={!irisText}>
              <Copy className="h-4 w-4 mr-2" /> Copiar texto
            </Button>
            {req.status === 'Aprovada' && canManage && (
              <Button
                onClick={handleCreateWordpressDraft}
                disabled={
                  wpLoading ||
                  !irisTitle.trim() ||
                  !irisText.trim() ||
                  !irisInternalProfile.trim() ||
                  irisTitle.trim().length > IRIS_REVIEW_LIMITS.title ||
                  irisText.trim().length > IRIS_REVIEW_LIMITS.publicText ||
                  irisInternalProfile.trim().length > IRIS_REVIEW_LIMITS.internalProfile
                }
              >
                {wpLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Globe className="h-4 w-4 mr-2" />
                )}
                Confirmar e criar somente o rascunho
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showManualContingency} onOpenChange={setShowManualContingency}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rascunho manual durante a contingência</DialogTitle>
            <DialogDescription>
              Revise integralmente os três campos. Esta ação cria somente um rascunho no WordPress;
              ela não publica a vaga, não aprova a requisição e não substitui a revisão humana.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="manual-contingency-title">Título público</Label>
              <Textarea
                id="manual-contingency-title"
                value={manualTitle}
                onChange={(event) => setManualTitle(event.target.value)}
                rows={2}
                maxLength={IRIS_REVIEW_LIMITS.title}
              />
              <p className="text-xs text-muted-foreground">
                {manualTitle.length}/{IRIS_REVIEW_LIMITS.title} caracteres
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="manual-contingency-public-description">Descrição pública</Label>
              <Textarea
                id="manual-contingency-public-description"
                value={manualPublicDescription}
                onChange={(event) => setManualPublicDescription(event.target.value)}
                rows={12}
                maxLength={IRIS_REVIEW_LIMITS.publicText}
              />
              <p className="text-xs text-muted-foreground">
                {manualPublicDescription.length}/{IRIS_REVIEW_LIMITS.publicText} caracteres
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="manual-contingency-internal-profile">
                Perfil interno para triagem
              </Label>
              <Textarea
                id="manual-contingency-internal-profile"
                value={manualInternalProfile}
                onChange={(event) => setManualInternalProfile(event.target.value)}
                rows={10}
                maxLength={IRIS_REVIEW_LIMITS.internalProfile}
              />
              <p className="text-xs text-amber-700">
                Campo interno e não público. Ele será armazenado separadamente da descrição da vaga.
              </p>
              <p className="text-xs text-muted-foreground">
                {manualInternalProfile.length}/{IRIS_REVIEW_LIMITS.internalProfile} caracteres
              </p>
            </div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Somente rascunho</AlertTitle>
              <AlertDescription>
                Nenhum conteúdo será publicado automaticamente. O rascunho deverá ser revisado e
                publicado separadamente no WordPress.
              </AlertDescription>
            </Alert>
            <div className="flex items-start gap-3 rounded-md border p-3">
              <Checkbox
                id="manual-contingency-confirmation"
                checked={manualConfirmed}
                onCheckedChange={(checked) => setManualConfirmed(checked === true)}
              />
              <Label htmlFor="manual-contingency-confirmation" className="leading-5">
                Confirmo que revisei os três campos e autorizo a criação somente de um rascunho no
                WordPress.
              </Label>
            </div>
            {manualError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Não foi possível criar o rascunho manual</AlertTitle>
                <AlertDescription>{manualError}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowManualContingency(false)}
              disabled={manualLoading}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleManualContingencyDraft}
              disabled={
                manualLoading ||
                !canUseManualContingency(req.status, canManage, irisOperationalStatus) ||
                !manualConfirmed ||
                !manualTitle.trim() ||
                !manualPublicDescription.trim() ||
                !manualInternalProfile.trim()
              }
            >
              {manualLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar somente o rascunho no WordPress
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
