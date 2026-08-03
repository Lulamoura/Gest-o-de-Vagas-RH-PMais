import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getCandidate, updateCandidate, sendAvisoIntegracaoCandidato } from '@/services/candidates'
import { getEmailLogsForCandidate, hasEmailBeenSent } from '@/services/candidate_email_logs'
import { getBaseIntegracao } from '@/services/base_integracao'
import { CandidateRecord, CandidateEmailLogRecord, BaseIntegracaoRecord } from '@/types'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { IntegrationNoticeModal } from '@/components/IntegrationNoticeModal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { getCandidateStatusBadgeClass, formatDateBR } from '@/lib/status-utils'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle, Calendar, Mail, Check } from 'lucide-react'

export default function CandidateIntegrationView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isOperator, isSuperAdmin } = useAuth()
  const canMarkIntegrated = isOperator || isSuperAdmin

  const [candidate, setCandidate] = useState<CandidateRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [integrating, setIntegrating] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [emailLogs, setEmailLogs] = useState<CandidateEmailLogRecord[]>([])
  const [sendingIntegration, setSendingIntegration] = useState(false)
  const [integrationModalOpen, setIntegrationModalOpen] = useState(false)
  const [baseIntegracoes, setBaseIntegracoes] = useState<BaseIntegracaoRecord[]>([])

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
      setBaseIntegracoes(bases)
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

  const handleSendIntegrationNotice = async (baseIntegracaoId?: string) => {
    if (!candidate) return
    setSendingIntegration(true)
    try {
      await sendAvisoIntegracaoCandidato(candidate.id, baseIntegracaoId)
      toast.success('E-mail de integração enviado!')
      const logs = await getEmailLogsForCandidate(candidate.id)
      setEmailLogs(logs)
    } catch {
      toast.error('Erro ao enviar e-mail')
    } finally {
      setSendingIntegration(false)
    }
  }

  const handleIntegrationEmailClick = () => {
    if (!candidate) return
    if (candidate.tipo_integracao === 'Presencial') {
      setIntegrationModalOpen(true)
    } else {
      handleSendIntegrationNotice()
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
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-center">
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

            <div className="flex items-center justify-center gap-3">
              <Badge
                variant="outline"
                className={getCandidateStatusBadgeClass(candidate.status_candidato)}
              >
                {candidate.status_candidato}
              </Badge>
            </div>

            {candidate.status_candidato === 'Cadastro DP' && candidate.integracao_ativa && (
              <Button
                type="button"
                variant="outline"
                onClick={handleIntegrationEmailClick}
                disabled={sendingIntegration || !candidate.email}
                className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                title={!candidate.email ? 'Candidato não possui e-mail cadastrado' : ''}
              >
                <Mail className="h-4 w-4 mr-2" />
                {sendingIntegration ? 'Enviando...' : 'Enviar Aviso de Integração'}
                {hasEmailBeenSent(emailLogs, 'aviso_integracao_candidato') && (
                  <Check className="h-4 w-4 ml-2 text-emerald-600" />
                )}
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

      <IntegrationNoticeModal
        open={integrationModalOpen}
        onOpenChange={setIntegrationModalOpen}
        candidate={candidate}
        baseIntegracoes={baseIntegracoes}
        onSend={(baseId) => {
          handleSendIntegrationNotice(baseId)
          setIntegrationModalOpen(false)
        }}
      />
    </div>
  )
}
