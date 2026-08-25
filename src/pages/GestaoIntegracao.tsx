import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  getCandidates,
  getIntegrationCandidates,
  sendAvisoIntegracaoCandidato,
} from '@/services/candidates'
import { getBaseIntegracao } from '@/services/base_integracao'
import { computeReturningCounts } from '@/services/candidate_returning'
import {
  getEmailLogsForCandidate,
  getEmailLogsForCandidates,
  hasEmailBeenSent,
} from '@/services/candidate_email_logs'
import { CandidateRecord, BaseIntegracaoRecord, CandidateEmailLogRecord } from '@/types'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { IntegrationNoticeModal } from '@/components/IntegrationNoticeModal'
import { getCandidateStatusBadgeClass } from '@/lib/status-utils'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { formatDateNoTimezone } from '@/lib/date-utils'
import { toast } from 'sonner'
import { Search, Mail, Check, Eye, Calendar, Clock, RotateCcw } from 'lucide-react'

export default function GestaoIntegracao() {
  const { canIntegrateCandidate } = useAuth()
  const canSendAviso = canIntegrateCandidate
  const [candidates, setCandidates] = useState<CandidateRecord[]>([])
  const [allCandidates, setAllCandidates] = useState<CandidateRecord[]>([])
  const [baseIntegracao, setBaseIntegracao] = useState<BaseIntegracaoRecord[]>([])
  const [baseIntegracaoLoaded, setBaseIntegracaoLoaded] = useState(false)
  const [emailLogsMap, setEmailLogsMap] = useState<Record<string, CandidateEmailLogRecord[]>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [avisoModalOpen, setAvisoModalOpen] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateRecord | null>(null)
  const [sendingAviso, setSendingAviso] = useState(false)
  const [confirmAvisoOpen, setConfirmAvisoOpen] = useState(false)

  const loadData = async () => {
    try {
      const [data, fullList] = await Promise.all([
        getIntegrationCandidates(),
        getCandidates().catch(() => []),
      ])
      setCandidates(data)
      setAllCandidates(fullList)
      const allLogs = await getEmailLogsForCandidates(
        data.map((c) => c.id),
        'aviso_integracao_candidato',
      )
      const logsMap: Record<string, CandidateEmailLogRecord[]> = {}
      allLogs.forEach((log) => {
        if (!logsMap[log.candidate_id]) logsMap[log.candidate_id] = []
        logsMap[log.candidate_id].push(log)
      })
      setEmailLogsMap(logsMap)
    } catch {
      toast.error('Erro ao carregar candidatos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const loadBaseIntegracao = async () => {
    if (baseIntegracaoLoaded) return
    try {
      const bases = await getBaseIntegracao()
      setBaseIntegracao(bases)
      setBaseIntegracaoLoaded(true)
    } catch {
      toast.error('Erro ao carregar bases de integração')
    }
  }

  const returningCounts = useMemo(() => {
    const listToCompare = allCandidates.length > 0 ? allCandidates : candidates
    return computeReturningCounts(listToCompare)
  }, [allCandidates, candidates])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return candidates
    return candidates.filter((c) => {
      const vacancy = c.expand?.vacancy_id
      const vacancyName = vacancy?.expand?.cargo?.nome || vacancy?.expand?.cliente?.nome || ''
      return [c.nome, c.email, vacancyName]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q))
    })
  }, [candidates, search])

  const handleSendAvisoClick = (candidate: CandidateRecord) => {
    setSelectedCandidate(candidate)
    setConfirmAvisoOpen(true)
  }

  const handleConfirmAviso = async () => {
    if (!selectedCandidate) return
    if (selectedCandidate.tipo_integracao === 'Presencial') {
      await loadBaseIntegracao()
      setConfirmAvisoOpen(false)
      setAvisoModalOpen(true)
      return
    }
    setSendingAviso(true)
    try {
      await sendAvisoIntegracaoCandidato(selectedCandidate.id)
      toast.success('Aviso de integração enviado!')
      setConfirmAvisoOpen(false)
      const logs = await getEmailLogsForCandidate(selectedCandidate.id)
      setEmailLogsMap((prev) => ({ ...prev, [selectedCandidate.id]: logs }))
    } catch {
      toast.error('Erro ao enviar aviso de integração')
    } finally {
      setSendingAviso(false)
    }
  }

  const handleSendAvisoPresencial = async (baseId: string) => {
    if (!selectedCandidate) return
    setSendingAviso(true)
    try {
      await sendAvisoIntegracaoCandidato(selectedCandidate.id, baseId)
      toast.success('Aviso de integração enviado!')
      setAvisoModalOpen(false)
      const logs = await getEmailLogsForCandidate(selectedCandidate.id)
      setEmailLogsMap((prev) => ({ ...prev, [selectedCandidate.id]: logs }))
    } catch {
      toast.error('Erro ao enviar aviso de integração')
    } finally {
      setSendingAviso(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestão de Integração</h1>
          <p className="text-slate-500 text-xs mt-1">
            Candidatos aguardando integração ({candidates.length})
          </p>
        </div>
        <div className="relative">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Buscar candidato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 w-56 text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="p-8 text-center text-slate-500 text-sm">
            {search ? 'Nenhum candidato encontrado.' : 'Nenhum candidato aguardando integração.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const vacancy = c.expand?.vacancy_id
            const vacancyName =
              vacancy?.expand?.cargo?.nome || vacancy?.expand?.cliente?.nome || '—'
            const logs = emailLogsMap[c.id] || []
            const avisoSent = hasEmailBeenSent(logs, 'aviso_integracao_candidato')
            return (
              <Card key={c.id} className="border-slate-200 hover:border-slate-300 transition-all">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <CardTitle className="text-base font-bold text-slate-900 line-clamp-1">
                          {c.nome}
                        </CardTitle>
                        {(returningCounts[c.id] || 0) > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="outline"
                                className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] font-medium px-1.5 py-0 inline-flex items-center gap-1 cursor-help shrink-0"
                              >
                                <RotateCcw className="h-2.5 w-2.5" />
                                Retornante
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              Já participou de {returningCounts[c.id]}{' '}
                              {returningCounts[c.id] === 1
                                ? 'processo anterior'
                                : 'processos anteriores'}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{vacancyName}</p>
                      {vacancy?.expand?.cliente?.nome &&
                        vacancy.expand.cliente.nome !== vacancyName && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            {vacancy.expand.cliente.nome}
                          </p>
                        )}
                    </div>
                    <Badge
                      variant="outline"
                      className={getCandidateStatusBadgeClass(c.status_candidato)}
                    >
                      {c.status_candidato}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs">
                      <Calendar className="h-4 w-4 text-indigo-600" />
                      <span className="font-bold text-indigo-700">Data:</span>
                      <span className="text-indigo-900">
                        {c.data_integracao
                          ? formatDateNoTimezone(c.data_integracao)
                          : 'Não definida'}
                      </span>
                    </div>
                    {(c.hora_integracao || c.tipo_integracao) && (
                      <div className="flex items-center gap-3 pt-1 border-t border-indigo-200">
                        {c.hora_integracao && (
                          <div className="flex items-center gap-1 text-xs">
                            <Clock className="h-3.5 w-3.5 text-indigo-600" />
                            <span className="font-bold text-indigo-700">Hora:</span>
                            <span className="text-indigo-900">{c.hora_integracao}</span>
                          </div>
                        )}
                        {c.tipo_integracao && (
                          <Badge
                            variant="outline"
                            className="text-xs bg-indigo-100 text-indigo-700 border-indigo-200"
                          >
                            {c.tipo_integracao}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="text-xs space-y-1 text-slate-600">
                    {c.email && <p className="truncate">E-mail: {c.email}</p>}
                    {c.telefone && <p>Tel: {c.telefone}</p>}
                  </div>

                  <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-100">
                    {canSendAviso && c.data_integracao && c.status_candidato !== 'Integrado' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSendAvisoClick(c)}
                        disabled={sendingAviso || !c.email}
                        className="h-7 w-8 p-0 text-indigo-600 hover:text-indigo-700 relative"
                        title="Envia aviso de integração"
                      >
                        <Mail className="h-4 w-4" />
                        {avisoSent && (
                          <Check className="h-3 w-3 absolute -top-0 -right-0 text-emerald-500" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="h-7 w-8 p-0 text-slate-500 hover:text-slate-900"
                    >
                      <Link to={`/integracao/${c.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={confirmAvisoOpen}
        onOpenChange={setConfirmAvisoOpen}
        title="Confirmar Envio"
        description={`O aviso de integração será enviado para ${selectedCandidate?.nome || 'o candidato'}. Deseja continuar?`}
        confirmText="Confirmar envio"
        cancelText="Cancelar"
        variant="primary"
        loading={sendingAviso}
        onConfirm={handleConfirmAviso}
      />

      <IntegrationNoticeModal
        open={avisoModalOpen}
        onOpenChange={setAvisoModalOpen}
        baseIntegracao={baseIntegracao}
        onSend={handleSendAvisoPresencial}
        sending={sendingAviso}
      />
    </div>
  )
}
