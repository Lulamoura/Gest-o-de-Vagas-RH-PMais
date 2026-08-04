import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getIntegrationCandidates, sendAvisoIntegracaoCandidato } from '@/services/candidates'
import { getBaseIntegracao } from '@/services/base_integracao'
import { getEmailLogsForCandidate, hasEmailBeenSent } from '@/services/candidate_email_logs'
import { CandidateRecord, BaseIntegracaoRecord, CandidateEmailLogRecord } from '@/types'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { IntegrationNoticeModal } from '@/components/IntegrationNoticeModal'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import { getCandidateStatusBadgeClass, formatDateBR } from '@/lib/status-utils'
import { toast } from 'sonner'
import { Search, Mail, Check, Eye, Calendar, Clock } from 'lucide-react'

export default function GestaoIntegracao() {
  const { isAdmin, isOperator, isSuperAdmin } = useAuth()
  const canSendAviso = isAdmin || isOperator || isSuperAdmin
  const [candidates, setCandidates] = useState<CandidateRecord[]>([])
  const [baseIntegracao, setBaseIntegracao] = useState<BaseIntegracaoRecord[]>([])
  const [emailLogsMap, setEmailLogsMap] = useState<Record<string, CandidateEmailLogRecord[]>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [avisoModalOpen, setAvisoModalOpen] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateRecord | null>(null)
  const [sendingAviso, setSendingAviso] = useState(false)

  const loadData = async () => {
    try {
      const [data, bases] = await Promise.all([getIntegrationCandidates(), getBaseIntegracao()])
      setCandidates(data)
      setBaseIntegracao(bases)
      const logsPromises = data.map((c) =>
        getEmailLogsForCandidate(c.id)
          .then((logs) => [c.id, logs] as const)
          .catch(() => [c.id, []] as const),
      )
      const logsResults = await Promise.all(logsPromises)
      const logsMap: Record<string, CandidateEmailLogRecord[]> = {}
      logsResults.forEach(([cid, logs]) => {
        logsMap[cid] = logs
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
  useRealtime<CandidateRecord>('candidates', () => loadData())
  useRealtime('candidate_email_log', () => loadData())

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
    if (candidate.tipo_integracao === 'Presencial') {
      setSelectedCandidate(candidate)
      setAvisoModalOpen(true)
    } else {
      handleSendAvisoDirect(candidate)
    }
  }

  const handleSendAvisoDirect = async (candidate: CandidateRecord) => {
    setSendingAviso(true)
    try {
      await sendAvisoIntegracaoCandidato(candidate.id)
      toast.success('Aviso de integração enviado!')
      const logs = await getEmailLogsForCandidate(candidate.id)
      setEmailLogsMap((prev) => ({ ...prev, [candidate.id]: logs }))
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
    <div className="space-y-4">
      <Card className="border-slate-200 shadow-2xs">
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-base font-bold text-slate-900">
            Gestão de Integração ({candidates.length})
          </CardTitle>
          <div className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Buscar candidato..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 w-56 text-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-xs font-semibold text-slate-600">Candidato</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Vaga</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Tipo</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Data</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Status</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 text-right">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-slate-500">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-slate-500 text-sm">
                    {search
                      ? 'Nenhum candidato encontrado.'
                      : 'Nenhum candidato aguardando integração.'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => {
                  const vacancy = c.expand?.vacancy_id
                  const vacancyName =
                    vacancy?.expand?.cargo?.nome || vacancy?.expand?.cliente?.nome || '—'
                  const logs = emailLogsMap[c.id] || []
                  const avisoSent = hasEmailBeenSent(logs, 'aviso_integracao_candidato')
                  return (
                    <TableRow key={c.id} className="hover:bg-slate-50">
                      <TableCell className="font-semibold text-slate-900 text-sm">
                        {c.nome}
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">{vacancyName}</TableCell>
                      <TableCell className="text-slate-600 text-sm">
                        {c.tipo_integracao ? (
                          <Badge variant="outline" className="text-xs">
                            {c.tipo_integracao}
                          </Badge>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">
                        {c.data_integracao ? formatDateBR(c.data_integracao) : '—'}
                        {c.hora_integracao && (
                          <span className="text-slate-400 ml-1">{c.hora_integracao}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getCandidateStatusBadgeClass(c.status_candidato)}
                        >
                          {c.status_candidato}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canSendAviso &&
                            c.data_integracao &&
                            c.status_candidato !== 'Integrado' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleSendAvisoClick(c)}
                                disabled={sendingAviso || !c.email}
                                className="h-8 w-8 text-indigo-600 hover:text-indigo-700"
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
                            size="icon"
                            asChild
                            className="h-8 w-8 text-slate-600"
                          >
                            <Link to={`/integracao/${c.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
