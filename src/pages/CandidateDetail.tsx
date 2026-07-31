import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  getCandidate,
  sendComplementDataRequest,
  sendDisqualificationNotice,
} from '@/services/candidates'
import { getEmailLogsForCandidate, hasEmailBeenSent } from '@/services/candidate_email_logs'
import { CandidateRecord, CandidateEmailLogRecord, CandidateStatus } from '@/types'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { CandidateLegalConsultation } from '@/components/CandidateLegalConsultation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, getCandidateStatusBadgeClass } from '@/lib/status-utils'
import { ArrowLeft, Mail, Phone, MapPin, CreditCard, Briefcase, Check } from 'lucide-react'
import { StarRating } from '@/components/StarRating'
import { toast } from 'sonner'

const COMPLEMENT_STATUSES: CandidateStatus[] = [
  'Análise do RH',
  'Análise do gestor',
  'Documentação e exame',
]

const DISQUALIFICATION_STATUSES: CandidateStatus[] = ['Desclassificado', 'Em banco']

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const fromVacancyId = (location.state as { fromVacancy?: string } | null)?.fromVacancy
  const { isAdmin, isSuperAdmin } = useAuth()
  const canEdit = isAdmin || isSuperAdmin

  const [candidate, setCandidate] = useState<CandidateRecord | null>(null)
  const [emailLogs, setEmailLogs] = useState<CandidateEmailLogRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [sendingDisqual, setSendingDisqual] = useState(false)

  const loadData = async () => {
    if (!id) return
    try {
      const [data, logs] = await Promise.all([getCandidate(id), getEmailLogsForCandidate(id)])
      setCandidate(data)
      setEmailLogs(logs)
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
  useRealtime('candidato_consultas_juridicas', () => loadData())

  const handleSendEmail = async () => {
    if (!candidate) return
    setSendingEmail(true)
    try {
      await sendComplementDataRequest(candidate.id)
      toast.success('E-mail enviado com sucesso!')
      const logs = await getEmailLogsForCandidate(candidate.id)
      setEmailLogs(logs)
    } catch {
      toast.error('Erro ao enviar e-mail')
    } finally {
      setSendingEmail(false)
    }
  }

  const handleSendDisqualification = async () => {
    if (!candidate) return
    setSendingDisqual(true)
    try {
      await sendDisqualificationNotice(candidate.id)
      toast.success('E-mail enviado com sucesso!')
      const logs = await getEmailLogsForCandidate(candidate.id)
      setEmailLogs(logs)
    } catch {
      toast.error('Erro ao enviar e-mail')
    } finally {
      setSendingDisqual(false)
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
  const totalCost =
    (candidate.custo_consultas || 0) +
    (candidate.custo_exames || 0) +
    (candidate.custo_testes || 0) +
    (candidate.custo_extras || 0)

  const showComplementBtn = canEdit && COMPLEMENT_STATUSES.includes(candidate.status_candidato)
  const showDisqualBtn = canEdit && DISQUALIFICATION_STATUSES.includes(candidate.status_candidato)

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        onClick={() => navigate(fromVacancyId ? `/vagas/${fromVacancyId}` : '/candidatos')}
        className="text-slate-600 self-start"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        {fromVacancyId ? 'Voltar para a Vaga' : 'Voltar para Candidatos'}
      </Button>

      <Card className="border-slate-200 shadow-2xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-bold text-slate-900">{candidate.nome}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-400" />
              <span className="text-slate-700">{candidate.email || '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-slate-400" />
              <span className="text-slate-700">{candidate.telefone || '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-slate-400" />
              <span className="text-slate-700">{candidate.cpf || '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-400" />
              <span className="text-slate-700">
                {[candidate.cidade, candidate.bairro].filter(Boolean).join(' - ') || '—'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-slate-400" />
              <span className="text-slate-700">
                {vacancy?.expand?.cargo?.nome || vacancy?.expand?.cliente?.nome || '—'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-semibold">Custo consultas:</span>
              <span className="text-slate-700 font-bold">
                {formatCurrency(candidate.custo_consultas || 0)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-semibold">Custo total:</span>
              <span className="text-slate-700 font-bold">{formatCurrency(totalCost)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
            <Badge
              variant="outline"
              className={getCandidateStatusBadgeClass(candidate.status_candidato)}
            >
              {candidate.status_candidato}
            </Badge>
            {candidate.rank != null && <StarRating value={candidate.rank} readOnly size={14} />}
          </div>

          {(showComplementBtn || showDisqualBtn) && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              {showComplementBtn && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSendEmail}
                  disabled={sendingEmail || !candidate.email}
                  className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                  title={!candidate.email ? 'Candidato não possui e-mail cadastrado' : ''}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {sendingEmail ? 'Enviando...' : 'Solicitar dados complementares'}
                  {hasEmailBeenSent(emailLogs, 'complement_data') && (
                    <Check className="h-4 w-4 ml-2 text-emerald-600" />
                  )}
                </Button>
              )}
              {showDisqualBtn && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSendDisqualification}
                  disabled={sendingDisqual || !candidate.email}
                  className="w-full border-amber-200 text-amber-700 hover:bg-amber-50"
                  title={!candidate.email ? 'Candidato não possui e-mail cadastrado' : ''}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {sendingDisqual ? 'Enviando...' : 'Aviso de Desclassificação/Banco'}
                  {hasEmailBeenSent(emailLogs, 'disqualification') && (
                    <Check className="h-4 w-4 ml-2 text-emerald-600" />
                  )}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <CandidateLegalConsultation
        candidateId={candidate.id}
        cpf={candidate.cpf}
        nome={candidate.nome}
        canConsult={canEdit}
      />
    </div>
  )
}
