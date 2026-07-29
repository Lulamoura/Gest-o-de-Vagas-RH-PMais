import { useState, useEffect, useCallback } from 'react'
import {
  getLatestConsultaJuridica,
  performConsultaJuridica,
} from '@/services/candidato_consultas_juridicas'
import { CandidatoConsultaJuridicaRecord } from '@/types'
import { validateCPF, formatCPF } from '@/lib/cpf-utils'
import { getField, getTopAssuntos, formatDateTime } from '@/lib/legal-utils'
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
import { Scale, RefreshCw, AlertCircle, Search } from 'lucide-react'

interface Props {
  candidateId: string
  cpf?: string
  nome?: string
  canConsult: boolean
}

export function CandidateLegalConsultation({ candidateId, cpf, canConsult }: Props) {
  const [loading, setLoading] = useState(true)
  const [consultando, setConsultando] = useState(false)
  const [consulta, setConsulta] = useState<CandidatoConsultaJuridicaRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showUpdateDialog, setShowUpdateDialog] = useState(false)

  const cpfValido = cpf ? validateCPF(cpf) : false

  const loadConsulta = useCallback(async () => {
    try {
      const result = await getLatestConsultaJuridica(candidateId)
      setConsulta(result)
    } catch {
      /* noop */
    } finally {
      setLoading(false)
    }
  }, [candidateId])

  useEffect(() => {
    loadConsulta()
  }, [loadConsulta])

  const handleConsultar = async () => {
    setConsultando(true)
    setError(null)
    try {
      await performConsultaJuridica(candidateId)
      await loadConsulta()
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

  if (!consulta) {
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

  const processos = consulta.processos_json || []
  const assuntos = getTopAssuntos(processos)
  const hasError = consulta.status_consulta === 'erro'

  return (
    <Card className="border-slate-200 shadow-2xs">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Scale className="h-5 w-5 text-indigo-600" /> Consulta jurídica — Escavador
        </CardTitle>
        <CardDescription className="text-xs">
          Resultados da consulta à base de processos
        </CardDescription>
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
              {consulta.erro || 'Erro na consulta'}
            </AlertDescription>
          </Alert>
        )}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-slate-50 p-2.5 rounded-lg">
            <span className="text-slate-400 block">CPF consultado</span>
            <span className="font-semibold text-slate-800">
              {formatCPF(consulta.cpf_consultado || cpf || '')}
            </span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-lg">
            <span className="text-slate-400 block">Data da consulta</span>
            <span className="font-semibold text-slate-800">
              {formatDateTime(consulta.consultado_em || consulta.created)}
            </span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-lg">
            <span className="text-slate-400 block">Consultado por</span>
            <span className="font-semibold text-slate-800">
              {consulta.expand?.consultado_por?.name || '—'}
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
                  {consulta.total_processos || 0}
                </span>
              </div>
              <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl text-center">
                <span className="text-[10px] font-semibold text-amber-800 uppercase block">
                  Ativos
                </span>
                <span className="text-2xl font-black text-amber-700">
                  {consulta.total_processos_ativos || 0}
                </span>
              </div>
              <div className="bg-slate-100 border border-slate-200 p-3 rounded-xl text-center">
                <span className="text-[10px] font-semibold text-slate-600 uppercase block">
                  Inativos
                </span>
                <span className="text-2xl font-black text-slate-600">
                  {consulta.total_processos_inativos || 0}
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
                Processos
              </span>
              {processos.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">
                  Nenhum processo encontrado
                </p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {processos.map((proc: any, i: number) => (
                    <div
                      key={i}
                      className="border border-slate-200 rounded-lg p-3 bg-white hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {getField(proc, 'numero', 'numero_cnj', 'numero_processo')}
                          </p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-1">
                            <span>
                              Tribunal:{' '}
                              <strong className="text-slate-700">
                                {getField(proc, 'tribunal', 'orgao', 'tribunal_sigla')}
                              </strong>
                            </span>
                            <span>
                              Classe:{' '}
                              <strong className="text-slate-700">
                                {getField(proc, 'classe', 'classe_processual', 'classe_nome')}
                              </strong>
                            </span>
                            <span>
                              Início:{' '}
                              <strong className="text-slate-700">
                                {getField(proc, 'data_ajuizamento', 'data_inicio', 'data')}
                              </strong>
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            <span>
                              Assunto:{' '}
                              <strong className="text-slate-700">
                                {Array.isArray(proc.assuntos)
                                  ? proc.assuntos
                                      .map((a: any) => (typeof a === 'string' ? a : a?.nome || ''))
                                      .join(', ')
                                  : getField(proc, 'assunto')}
                              </strong>
                            </span>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            getField(proc, 'status', 'situacao').toLowerCase().includes('inativo')
                              ? 'bg-slate-100 text-slate-600 border-slate-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }
                        >
                          {getField(proc, 'status', 'situacao')}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
        {cpfValido && (
          <>
            <Button
              variant="outline"
              onClick={() => setShowUpdateDialog(true)}
              disabled={consultando}
              className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              <RefreshCw className="h-4 w-4 mr-2" /> Atualizar consulta
            </Button>
            <AlertDialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Atualizar consulta jurídica</AlertDialogTitle>
                  <AlertDialogDescription>
                    A última consulta foi realizada em{' '}
                    {formatDateTime(consulta.consultado_em || consulta.created)}. Deseja realizar
                    uma nova consulta à API Escavador?
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
          </>
        )}
      </CardContent>
    </Card>
  )
}
