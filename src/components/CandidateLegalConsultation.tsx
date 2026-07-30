import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  getConsultaJuridicaHistory,
  performConsultaJuridica,
  getProcessoResumoIA,
  getProcessoAnaliseDetalhada,
  type ProcessAnalysis,
} from '@/services/candidato_consultas_juridicas'
import { CandidatoConsultaJuridicaRecord } from '@/types'
import { validateCPF, formatCPF } from '@/lib/cpf-utils'
import {
  getProcessNumber,
  getTribunalInfo,
  getProcessClass,
  getProcessData,
  getProcessAssunto,
  getField,
  getTopAssuntos,
  formatDateTime,
} from '@/lib/legal-utils'
import { ProcessDetailModal } from '@/components/ProcessDetailModal'
import { useRealtime } from '@/hooks/use-realtime'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Scale,
  RefreshCw,
  AlertCircle,
  Search,
  History,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
  Loader2,
  ChevronDown,
  ExternalLink,
  FileSearch,
} from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  candidateId: string
  cpf?: string
  nome?: string
  canConsult: boolean
}

type SummaryState = { summary?: string; loading: boolean; error?: string; expanded: boolean }

export function CandidateLegalConsultation({ candidateId, cpf, canConsult }: Props) {
  const [loading, setLoading] = useState(true)
  const [consultando, setConsultando] = useState(false)
  const [history, setHistory] = useState<CandidatoConsultaJuridicaRecord[]>([])
  const [selectedConsulta, setSelectedConsulta] = useState<CandidatoConsultaJuridicaRecord | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [showUpdateDialog, setShowUpdateDialog] = useState(false)
  const [interactionStates, setInteractionStates] = useState<Record<string, SummaryState>>({})
  const [analysisData, setAnalysisData] = useState<ProcessAnalysis | null>(null)
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false)
  const [analysisModalLoading, setAnalysisModalLoading] = useState(false)
  const [analysisModalError, setAnalysisModalError] = useState<string | null>(null)
  const [analysisModalNumero, setAnalysisModalNumero] = useState('')

  const cpfValido = cpf ? validateCPF(cpf) : false

  const loadData = useCallback(async () => {
    try {
      const records = await getConsultaJuridicaHistory(candidateId)
      setHistory(records)
      setSelectedConsulta((prev) => {
        if (!prev) return records[0] || null
        const updated = records.find((r) => r.id === prev.id)
        return updated || records[0] || null
      })
    } catch {
      /* noop */
    } finally {
      setLoading(false)
    }
  }, [candidateId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const selectedConsultaId = selectedConsulta?.id
  useEffect(() => {
    setInteractionStates({})
  }, [selectedConsultaId])

  useRealtime('candidato_consultas_juridicas', () => {
    loadData()
  })

  const extractSummaryText = (val: any): string | null => {
    if (val == null) return null
    if (typeof val === 'string') return val.trim() || null
    if (typeof val === 'object') {
      if (typeof val.text === 'string') return val.text
      if (typeof val.summary === 'string') return val.summary
      if (typeof val.content === 'string') return val.content
      try {
        const str = JSON.stringify(val)
        return str !== '{}' && str !== 'null' ? str : null
      } catch {
        return null
      }
    }
    return String(val)
  }

  const parseResumoJson = (raw: any): Record<string, any> | null => {
    if (raw == null) return null
    if (typeof raw === 'string') {
      if (!raw.trim()) return null
      try {
        const parsed = JSON.parse(raw)
        return typeof parsed === 'object' && parsed !== null ? parsed : null
      } catch {
        return null
      }
    }
    if (typeof raw === 'object') return raw as Record<string, any>
    return null
  }

  const summaryStates = useMemo<Record<string, SummaryState>>(() => {
    const merged: Record<string, SummaryState> = {}

    if (selectedConsulta) {
      const resumoJson = parseResumoJson(selectedConsulta.resumo_json)
      const processoResumos = resumoJson?.processo_resumos || {}
      for (const [num, rawSummary] of Object.entries(processoResumos)) {
        const summary = extractSummaryText(rawSummary)
        if (summary) {
          const itemState = {
            summary,
            loading: false,
            expanded: interactionStates[num]?.expanded ?? false,
            error: undefined,
          }
          merged[num] = itemState
          const cleanKey = num.replace(/[^\d]/g, '')
          if (cleanKey && cleanKey !== num && !merged[cleanKey]) {
            merged[cleanKey] = itemState
          }
        }
      }
    }

    for (const [num, state] of Object.entries(interactionStates)) {
      const cleanKey = num.replace(/[^\d]/g, '')
      if (state.loading || state.error) {
        merged[num] = state
        if (cleanKey && cleanKey !== num) {
          merged[cleanKey] = state
        }
      } else if (state.summary) {
        const itemState = {
          ...state,
          expanded: state.expanded ?? merged[num]?.expanded ?? true,
        }
        merged[num] = itemState
        if (cleanKey && cleanKey !== num) {
          merged[cleanKey] = itemState
        }
      } else if (merged[num]) {
        merged[num] = { ...merged[num], expanded: state.expanded }
        if (cleanKey && cleanKey !== num && merged[cleanKey]) {
          merged[cleanKey] = { ...merged[cleanKey], expanded: state.expanded }
        }
      }
    }

    return merged
  }, [selectedConsulta, interactionStates])

  const handleFetchSummary = async (numeroProcesso: string) => {
    if (!selectedConsulta) return
    const cleanKey = numeroProcesso.replace(/[^\d]/g, '')

    setInteractionStates((prev) => ({
      ...prev,
      [numeroProcesso]: {
        ...prev[numeroProcesso],
        loading: true,
        error: undefined,
        expanded: true,
      },
      ...(cleanKey && cleanKey !== numeroProcesso
        ? {
            [cleanKey]: {
              ...prev[cleanKey],
              loading: true,
              error: undefined,
              expanded: true,
            },
          }
        : {}),
    }))

    try {
      const result = await getProcessoResumoIA(numeroProcesso, selectedConsulta.id)

      setInteractionStates((prev) => ({
        ...prev,
        [numeroProcesso]: {
          summary: result.summary,
          loading: false,
          expanded: true,
          error: undefined,
        },
        ...(cleanKey && cleanKey !== numeroProcesso
          ? {
              [cleanKey]: {
                summary: result.summary,
                loading: false,
                expanded: true,
                error: undefined,
              },
            }
          : {}),
      }))

      setSelectedConsulta((prev) => {
        if (!prev) return prev
        const resumoJson = parseResumoJson(prev.resumo_json) || {}
        const processoResumos = { ...(resumoJson.processo_resumos || {}) }
        processoResumos[numeroProcesso] = result.summary
        if (cleanKey) processoResumos[cleanKey] = result.summary
        return {
          ...prev,
          resumo_json: {
            ...resumoJson,
            processo_resumos: processoResumos,
          },
        }
      })

      setHistory((prevHistory) =>
        prevHistory.map((item) => {
          if (item.id !== selectedConsulta.id) return item
          const resumoJson = parseResumoJson(item.resumo_json) || {}
          const processoResumos = { ...(resumoJson.processo_resumos || {}) }
          processoResumos[numeroProcesso] = result.summary
          if (cleanKey) processoResumos[cleanKey] = result.summary
          return {
            ...item,
            resumo_json: {
              ...resumoJson,
              processo_resumos: processoResumos,
            },
          }
        }),
      )

      toast.success('Resumo gerado com sucesso!')
    } catch (err: any) {
      let errorMsg = 'Não foi possível obter o resumo. Tente novamente mais tarde.'
      if (err?.response?.error) {
        errorMsg =
          typeof err.response.error === 'string'
            ? err.response.error
            : JSON.stringify(err.response.error)
      } else if (err?.response?.message) {
        errorMsg = err.response.message
      } else if (err?.message) {
        errorMsg = err.message
      }

      console.error('[CandidateLegalConsultation] Erro ao buscar resumo da IA:', {
        numeroProcesso,
        consultaId: selectedConsulta?.id,
        error: err,
      })
      toast.error(errorMsg)
      setInteractionStates((prev) => ({
        ...prev,
        [numeroProcesso]: {
          summary: prev[numeroProcesso]?.summary,
          loading: false,
          error: errorMsg,
          expanded: prev[numeroProcesso]?.expanded ?? false,
        },
        ...(cleanKey && cleanKey !== numeroProcesso
          ? {
              [cleanKey]: {
                summary: prev[cleanKey]?.summary,
                loading: false,
                error: errorMsg,
                expanded: prev[cleanKey]?.expanded ?? false,
              },
            }
          : {}),
      }))
    }
  }

  const toggleSummaryExpanded = (numeroProcesso: string) => {
    const cleanKey = numeroProcesso.replace(/[^\d]/g, '')
    const currentExpanded =
      summaryStates[numeroProcesso]?.expanded ??
      (cleanKey ? summaryStates[cleanKey]?.expanded : false) ??
      false

    setInteractionStates((prev) => ({
      ...prev,
      [numeroProcesso]: {
        ...prev[numeroProcesso],
        expanded: !currentExpanded,
      },
      ...(cleanKey && cleanKey !== numeroProcesso
        ? {
            [cleanKey]: {
              ...prev[cleanKey],
              expanded: !currentExpanded,
            },
          }
        : {}),
    }))
  }

  const handleOpenDetail = async (processData: any) => {
    const escavadorId = processData?.id != null ? String(processData.id).trim() : ''
    const rawNum = getProcessNumber(processData)
    const numeroProc =
      rawNum !== '—'
        ? rawNum
        : processData?.numero_cnj ||
          processData?.numero ||
          processData?.numero_processo ||
          processData?.titulo ||
          ''
    const procIdentifier = escavadorId || numeroProc || ''

    if (!procIdentifier) {
      toast.error('Não foi possível identificar o número ou ID do processo')
      return
    }
    if (!selectedConsulta) {
      toast.error('Nenhuma consulta selecionada')
      return
    }

    setAnalysisModalLoading(true)
    setAnalysisModalError(null)
    setAnalysisData(null)
    setAnalysisModalNumero(numeroProc !== '—' ? numeroProc : procIdentifier)
    setAnalysisModalOpen(true)

    try {
      const result = await getProcessoAnaliseDetalhada(selectedConsulta.id, procIdentifier)
      setAnalysisData(result)
    } catch (err: any) {
      const errorMsg =
        err?.response?.error ||
        err?.response?.message ||
        err?.message ||
        'Não foi possível gerar a análise detalhada. Tente novamente.'
      setAnalysisModalError(errorMsg)
    } finally {
      setAnalysisModalLoading(false)
    }
  }

  const handleConsultar = async () => {
    setConsultando(true)
    setError(null)
    try {
      await performConsultaJuridica(candidateId)
      await loadData()
    } catch (err: any) {
      setError(err?.message || 'Erro ao realizar consulta jurídica')
    } finally {
      setConsultando(false)
      setShowUpdateDialog(false)
    }
  }

  if (loading) {
    return (
      <Card className="border-slate-200 shadow-2xs">
        <CardContent className="p-6 text-center text-sm text-slate-500">
          Carregando consulta jurídica...
        </CardContent>
      </Card>
    )
  }

  if (!canConsult) return null

  const renderConsultButton = () => {
    if (!cpfValido) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button disabled className="bg-indigo-600 text-white opacity-50 cursor-not-allowed">
                <Search className="h-4 w-4 mr-2" /> Consulta jurídica
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {cpf
              ? 'CPF inválido. Verifique o cadastro do candidato.'
              : 'Candidato sem CPF cadastrado.'}
          </TooltipContent>
        </Tooltip>
      )
    }
    return (
      <Button
        onClick={handleConsultar}
        disabled={consultando}
        className="bg-indigo-600 hover:bg-indigo-500 text-white"
      >
        <Search className="h-4 w-4 mr-2" /> {consultando ? 'Consultando...' : 'Consulta jurídica'}
      </Button>
    )
  }

  if (history.length === 0 || !selectedConsulta) {
    return (
      <Card className="border-slate-200 shadow-2xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Scale className="h-5 w-5 text-indigo-600" /> Consulta jurídica — Escavador
          </CardTitle>
          <CardDescription className="text-xs">
            Consulte processos judiciais vinculados ao CPF do candidato
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert className="mb-4 border-rose-200 bg-rose-50">
              <AlertCircle className="h-4 w-4 text-rose-600" />
              <AlertDescription className="text-rose-700">{error}</AlertDescription>
            </Alert>
          )}
          {renderConsultButton()}
        </CardContent>
      </Card>
    )
  }

  const processos = selectedConsulta.processos_json || []
  const assuntos = getTopAssuntos(processos)
  const hasError = selectedConsulta.status_consulta === 'erro'

  const renderStatusBadge = (status: string) => {
    if (status === 'sucesso') {
      return (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Sucesso
        </Badge>
      )
    }
    if (status === 'sem_resultados') {
      return (
        <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200">
          <HelpCircle className="h-3 w-3 mr-1" /> Sem resultados
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
        <XCircle className="h-3 w-3 mr-1" /> Erro
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-2xs">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Scale className="h-5 w-5 text-indigo-600" /> Consulta jurídica — Escavador
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Resultados da consulta selecionada
            </CardDescription>
          </div>
          {renderStatusBadge(selectedConsulta.status_consulta)}
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert className="border-rose-200 bg-rose-50">
              <AlertCircle className="h-4 w-4 text-rose-600" />
              <AlertDescription className="text-rose-700">{error}</AlertDescription>
            </Alert>
          )}
          {hasError && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700">
                {selectedConsulta.erro || 'Erro na consulta'}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <span className="text-slate-400 block font-medium">CPF consultado</span>
              <span className="font-semibold text-slate-800">
                {formatCPF(selectedConsulta.cpf_consultado || cpf || '')}
              </span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <span className="text-slate-400 block font-medium">Data da consulta</span>
              <span className="font-semibold text-slate-800">
                {formatDateTime(selectedConsulta.consultado_em || selectedConsulta.created)}
              </span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <span className="text-slate-400 block font-medium">Consultado por</span>
              <span className="font-semibold text-slate-800 truncate block">
                {selectedConsulta.expand?.consultado_por?.name || '—'}
              </span>
            </div>
          </div>

          {!hasError && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl text-center">
                  <span className="text-[10px] font-semibold text-indigo-800 uppercase block">
                    Total
                  </span>
                  <span className="text-2xl font-black text-indigo-700">
                    {selectedConsulta.total_processos || 0}
                  </span>
                </div>
                <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl text-center">
                  <span className="text-[10px] font-semibold text-amber-800 uppercase block">
                    Ativos
                  </span>
                  <span className="text-2xl font-black text-amber-700">
                    {selectedConsulta.total_processos_ativos || 0}
                  </span>
                </div>
                <div className="bg-slate-100 border border-slate-200 p-3 rounded-xl text-center">
                  <span className="text-[10px] font-semibold text-slate-600 uppercase block">
                    Inativos
                  </span>
                  <span className="text-2xl font-black text-slate-600">
                    {selectedConsulta.total_processos_inativos || 0}
                  </span>
                </div>
              </div>

              {assuntos.length > 0 && (
                <div>
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-2">
                    Assuntos / Classes principais
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {assuntos.map((a) => (
                      <Badge
                        key={a.label}
                        variant="outline"
                        className="bg-slate-50 text-slate-700 border-slate-200"
                      >
                        {a.label} ({a.count})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-2">
                  Processos ({processos.length})
                </span>
                {processos.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    Nenhum processo encontrado para este candidato.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {processos.map((proc: any, i: number) => {
                      const rawNum = getProcessNumber(proc)
                      const procIdStr = proc?.id ? String(proc.id) : ''
                      const numero =
                        rawNum !== '—'
                          ? rawNum
                          : proc.numero_cnj ||
                            proc.numero ||
                            proc.numero_processo ||
                            procIdStr ||
                            '—'
                      const procIdentifier = numero !== '—' ? numero : procIdStr
                      const tribunalInfo = getTribunalInfo(proc)
                      const classe = getProcessClass(proc)
                      const dataAjuiz = getProcessData(proc)
                      const assunto = getProcessAssunto(proc)
                      const statusProc = getField(proc, 'status', 'situacao')
                      const isInactive = statusProc.toLowerCase().includes('inativo')
                      const cleanNum = numero.replace(/[^\d]/g, '')
                      const currentSummaryState =
                        summaryStates[procIdentifier] ||
                        summaryStates[numero] ||
                        (cleanNum ? summaryStates[cleanNum] : undefined) ||
                        (procIdStr ? summaryStates[procIdStr] : undefined)

                      return (
                        <div
                          key={i}
                          className="border border-slate-200 rounded-xl p-3.5 bg-white hover:border-slate-300 transition-all shadow-2xs space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2 flex-wrap sm:flex-nowrap">
                            <div className="min-w-0 flex-1 flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-bold text-slate-900 break-all">
                                {numero}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {procIdentifier !== '' &&
                                (currentSummaryState?.summary ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => toggleSummaryExpanded(procIdentifier)}
                                    className="h-7 px-2.5 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                                  >
                                    <ChevronDown
                                      className={`h-3 w-3 mr-1 transition-transform ${
                                        currentSummaryState?.expanded ? 'rotate-180' : ''
                                      }`}
                                    />
                                    {currentSummaryState?.expanded
                                      ? 'Ocultar resumo'
                                      : 'Ver resumo'}
                                  </Button>
                                ) : currentSummaryState?.loading ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled
                                    className="h-7 px-2.5 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                                  >
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    Gerando...
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleFetchSummary(procIdentifier)}
                                    className="h-7 px-2.5 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                                  >
                                    <Sparkles className="h-3 w-3 mr-1" />
                                    Resumo da IA
                                  </Button>
                                ))}
                              {procIdentifier !== '' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenDetail(proc)}
                                  className="h-7 px-2.5 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                                >
                                  <FileSearch className="h-3 w-3 mr-1" />
                                  Análise Detalhada
                                </Button>
                              )}
                              <Badge
                                variant="outline"
                                className={
                                  isInactive
                                    ? 'bg-slate-100 text-slate-600 border-slate-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }
                              >
                                {statusProc !== '—' ? statusProc : isInactive ? 'Inativo' : 'Ativo'}
                              </Badge>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-600 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                            <div>
                              <span className="text-slate-400">Tribunal: </span>
                              <strong className="text-slate-800 font-semibold">
                                {tribunalInfo.display}
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-400">Classe: </span>
                              <strong className="text-slate-800 font-semibold">{classe}</strong>
                            </div>
                            <div>
                              <span className="text-slate-400">Distribuição: </span>
                              <strong className="text-slate-800 font-semibold">{dataAjuiz}</strong>
                            </div>
                          </div>

                          <div className="text-xs text-slate-600">
                            <span className="text-slate-400">Assunto: </span>
                            <span className="text-slate-800 font-medium">{assunto}</span>
                          </div>

                          {currentSummaryState?.summary && currentSummaryState?.expanded && (
                            <div className="border-t border-slate-100 pt-2">
                              <div className="p-3.5 bg-indigo-50/70 rounded-lg border border-indigo-100 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                                <div className="flex items-center gap-1.5 font-bold text-indigo-900 mb-1.5">
                                  <Sparkles className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                                  <span>Resumo da IA</span>
                                </div>
                                {currentSummaryState.summary}
                              </div>
                            </div>
                          )}

                          {currentSummaryState?.error && (
                            <div className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-100">
                              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                              <span>{currentSummaryState.error}</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {cpfValido && (
            <div className="pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => setShowUpdateDialog(true)}
                disabled={consultando}
                className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              >
                <RefreshCw className="h-4 w-4 mr-2" /> Realizar nova consulta
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico de Consultas Jurídicas Section */}
      <Card className="border-slate-200 shadow-2xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-slate-900 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <History className="h-5 w-5 text-indigo-600" /> Histórico de Consultas Jurídicas
            </span>
            <Badge variant="secondary" className="bg-slate-100 text-slate-700">
              {history.length} {history.length === 1 ? 'registro' : 'registros'}
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Registro de todas as consultas já realizadas para este candidato
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {history.map((item) => {
              const isSelected = item.id === selectedConsulta.id
              const totalProc = item.total_processos || 0
              const ativosProc = item.total_processos_ativos || 0

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedConsulta(item)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50/50 shadow-2xs'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 bg-white'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        {formatDateTime(item.consultado_em || item.created)}
                      </span>
                      {renderStatusBadge(item.status_consulta)}
                      {isSelected && (
                        <Badge className="bg-indigo-600 text-white text-[10px] h-5">
                          Visualizando
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      <span>Realizado por: </span>
                      <span className="font-medium text-slate-700">
                        {item.expand?.consultado_por?.name || 'Sistema'}
                      </span>
                      <span className="mx-1.5">•</span>
                      <span>CPF: {formatCPF(item.cpf_consultado || '')}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 text-xs shrink-0">
                    <div className="text-right">
                      <span className="font-bold text-slate-800 block">
                        {totalProc} {totalProc === 1 ? 'processo' : 'processos'}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        ({ativosProc} {ativosProc === 1 ? 'ativo' : 'ativos'})
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant={isSelected ? 'default' : 'ghost'}
                      className={
                        isSelected
                          ? 'bg-indigo-600 text-white h-8 text-xs'
                          : 'text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 h-8 text-xs'
                      }
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedConsulta(item)
                      }}
                    >
                      {isSelected ? 'Selecionado' : 'Ver detalhes'}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Atualizar consulta jurídica</AlertDialogTitle>
            <AlertDialogDescription>
              A última consulta foi realizada em{' '}
              {formatDateTime(selectedConsulta.consultado_em || selectedConsulta.created)}. Deseja
              realizar uma nova consulta na API Escavador?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              onClick={handleConsultar}
              disabled={consultando}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              {consultando ? 'Consultando...' : 'Confirmar nova consulta'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ProcessDetailModal
        analysisData={analysisData}
        processoNumero={analysisModalNumero}
        open={analysisModalOpen}
        onOpenChange={setAnalysisModalOpen}
        loading={analysisModalLoading}
        error={analysisModalError}
      />
    </div>
  )
}
