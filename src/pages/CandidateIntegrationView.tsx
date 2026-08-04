import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getCandidate, updateCandidate, sendAvisoIntegracaoCandidato } from '@/services/candidates'
import { getBaseIntegracao } from '@/services/base_integracao'
import { getEmailLogsForCandidate, hasEmailBeenSent } from '@/services/candidate_email_logs'
import { CandidateRecord, BaseIntegracaoRecord, CandidateEmailLogRecord } from '@/types'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { IntegrationNoticeModal } from '@/components/IntegrationNoticeModal'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { getCandidateStatusBadgeClass, formatCurrency, formatDateBR } from '@/lib/status-utils'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle, Calendar, Clock, Mail, Check, DollarSign } from 'lucide-react'

export default function CandidateIntegrationView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isOperator, isSuperAdmin, isAdmin } = useAuth()
  const canMarkIntegrated = isOperator || isSuperAdmin
  const canSendAviso = isAdmin || isOperator || isSuperAdmin

  const [candidate, setCandidate] = useState<CandidateRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [integrating, setIntegrating] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [avisoModalOpen, setAvisoModalOpen] = useState(false)
  const [baseIntegracao, setBaseIntegracao] = useState<BaseIntegracaoRecord[]>([])
  const [sendingAviso, setSendingAviso] = useState(false)
  const [emailLogs, setEmailLogs] = useState<CandidateEmailLogRecord[]>([])

  const loadData = async () => {
    if (!id) return
    try {
      const [data, logs, bases] = await Promise.all([
        getCandidate(id),
        getEmailLogsForCandidate(id),
        getBaseIntegracao(),
      ])
      setCandidate(data)
      setEmailLogs(logs)
      setBaseIntegracao(bases)
    } catch {
      toast.error('Erro ao carregar candidato')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  useRealtime('candidates', () => loadData())
  useRealtime('candidate_email_log', () => {
    if (id)
      getEmailLogsForCandidate(id)
        .then(setEmailLogs)
        .catch(() => {})
  })

  const handleMarkIntegrated = async () => {
    if (!candidate) return
    setIntegrating(true)
    try {
      await updateCandidate(candidate.id, { status_candidato: 'Integrado' })
      toast.success('Candidato marcado como Integrado!')
      setConfirmOpen(false)
      navigate('/integracao')
    } catch {
      toast.error('Erro ao atualizar status do candidato')
    } finally {
      setIntegrating(false)
    }
  }

  const handleSendAvisoClick = () => {
    if (!candidate) return
    if (candidate.tipo_integracao === 'Presencial') {
      setAvisoModalOpen(true)
    } else {
      handleSendAvisoDirect()
    }
  }

  const handleSendAvisoDirect = async () => {
    if (!candidate) return
    setSendingAviso(true)
    try {
      await sendAvisoIntegracaoCandidato(candidate.id)
      toast.success('Aviso de integração enviado!')
      const logs = await getEmailLogsForCandidate(candidate.id)
      setEmailLogs(logs)
    } catch {
      toast.error('Erro ao enviar aviso de integração')
    } finally {
      setSendingAviso(false)
    }
  }

  const handleSendAvisoPresencial = async (baseId: string) => {
    if (!candidate) return
    setSendingAviso(true)
    try {
      await sendAvisoIntegracaoCandidato(candidate.id, baseId)
      toast.success('Aviso de integração enviado!')
      setAvisoModalOpen(false)
      const logs = await getEmailLogsForCandidate(candidate.id)
      setEmailLogs(logs)
    } catch {
      toast.error('Erro ao enviar aviso de integração')
    } finally {
      setSendingAviso(false)
    }
  }

  if (loading || !candidate) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    )
  }

  const vacancy = candidate.expand?.vacancy_id
  const avisoSent = hasEmailBeenSent(emailLogs, 'aviso_integracao_candidato')

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        onClick={() => navigate('/integracao')}
        className="text-slate-600 self-start"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar para Integração
      </Button>

      <Card className="border-slate-200 shadow-2xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-bold text-slate-900">
            Candidato - {candidate.nome}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Nome Completo</Label>
              <Input value={candidate.nome || ''} disabled />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Vaga</Label>
              <Input
                value={vacancy?.expand?.cargo?.nome || vacancy?.expand?.cliente?.nome || '—'}
                disabled
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">E-mail</Label>
              <Input value={candidate.email || '—'} disabled />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Telefone</Label>
              <Input value={candidate.telefone || '—'} disabled />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">CPF</Label>
              <Input value={candidate.cpf || '—'} disabled />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Status no Pipeline</Label>
              <Input value={candidate.status_candidato || '—'} disabled />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Cidade</Label>
              <Input value={candidate.cidade || '—'} disabled />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Bairro</Label>
              <Input value={candidate.bairro || '—'} disabled />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
              Dados Complementares
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">RG</Label>
                <Input value={candidate.rg || '—'} disabled />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Tamanho Fardamento</Label>
                <Input value={candidate.tamanho_fardamento || '—'} disabled />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Tamanho Sapato</Label>
                <Input value={candidate.tamanho_sapato || '—'} disabled />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">
                  Vale-transporte (qtd/dia)
                </Label>
                <Input value={String(candidate.vale_transporte_qtd ?? 0)} disabled />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Data de Nascimento</Label>
                <Input
                  value={candidate.data_nascimento ? formatDateBR(candidate.data_nascimento) : '—'}
                  disabled
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">
                  Valor Unitário do Transporte
                </Label>
                <Input
                  value={
                    candidate.valor_unitario_transporte
                      ? formatCurrency(candidate.valor_unitario_transporte)
                      : '—'
                  }
                  disabled
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Nome do Pai</Label>
                <Input value={candidate.nome_pai || '—'} disabled />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Nome da Mãe</Label>
                <Input value={candidate.nome_mae || '—'} disabled />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-bold text-slate-700">Telefone para Emergência</Label>
                <Input value={candidate.telefone_emergencia || '—'} disabled />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 space-y-4">
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-center space-y-2">
              <div>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Calendar className="h-5 w-5 text-indigo-600" />
                  <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                    Data da Integração
                  </p>
                </div>
                <p className="text-xl font-bold text-indigo-900">
                  {candidate.data_integracao
                    ? formatDateBR(candidate.data_integracao)
                    : 'Não definida'}
                </p>
              </div>
              {(candidate.hora_integracao || candidate.tipo_integracao) && (
                <div className="flex items-center justify-center gap-3 pt-2 border-t border-indigo-200">
                  {candidate.hora_integracao && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4 text-indigo-600" />
                      <span className="text-sm font-bold text-indigo-900">
                        {candidate.hora_integracao}
                      </span>
                    </div>
                  )}
                  {candidate.tipo_integracao && (
                    <span className="text-xs font-semibold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                      {candidate.tipo_integracao}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-3">
              <Badge
                variant="outline"
                className={getCandidateStatusBadgeClass(candidate.status_candidato)}
              >
                {candidate.status_candidato}
              </Badge>
            </div>

            {canSendAviso &&
              candidate.data_integracao &&
              candidate.status_candidato !== 'Integrado' && (
                <Button
                  onClick={handleSendAvisoClick}
                  disabled={sendingAviso || !candidate.email}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white"
                  title={!candidate.email ? 'Candidato não possui e-mail cadastrado' : ''}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {sendingAviso ? 'Enviando...' : 'Envia aviso de integração'}
                  {avisoSent && <Check className="h-4 w-4 ml-2 text-emerald-300" />}
                </Button>
              )}

            {canMarkIntegrated && candidate.status_candidato === 'Cadastro DP' && (
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={integrating}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {integrating ? 'Integrando...' : 'Integrado'}
              </Button>
            )}

            {candidate.status_candidato === 'Integrado' && (
              <div className="flex items-center justify-center gap-2 text-emerald-600 font-semibold text-sm">
                <CheckCircle className="h-5 w-5" />
                Candidato já integrado
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <IntegrationNoticeModal
        open={avisoModalOpen}
        onOpenChange={setAvisoModalOpen}
        baseIntegracao={baseIntegracao}
        onSend={handleSendAvisoPresencial}
        sending={sendingAviso}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmação de Integração</AlertDialogTitle>
            <AlertDialogDescription>Confirmar a integração deste candidato?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={integrating}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMarkIntegrated}
              disabled={integrating}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {integrating ? 'Integrando...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
