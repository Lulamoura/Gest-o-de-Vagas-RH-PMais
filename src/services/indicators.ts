import pb from '@/lib/pocketbase/client'

export interface IndicatorsSummary {
  openVacancies: number
  closedVacancies: number
  closedVacanciesMonth: number
  averageClosingDays: number
  delayedVacancies: number
  conversionRate: { integrados: number; total: number; taxa: number }
  overallAverageRank: number
  mandatoryIndicator: {
    candidatosEmProcesso: number
    totalPosicoes: number
    candidatosIntegrados: number
  }
  statusChart: { name: string; value: number }[]
  candidatesPerPhase: { fase: string; total: number }[]
  vacanciesByType: { name: string; value: number }[]
  candidatesByTypeVaga: { name: string; value: number }[]
  candidatesByTypeContrato: { name: string; value: number }[]
  rankingPerVacancy: Array<{
    vId: string
    cargo: string
    cliente: string
    contrato: string
    avgRank: number
    count: number
  }>
  stalledVacancies: Array<{
    id: string
    cargo: string
    cliente: string
    contrato: string
    diasParado: number
    responsavelRh: string
    dataAbertura: string
    prazoDesejado: string
  }>
  totalAccumulatedCost: number
  costBreakdown: {
    consultas: number
    exames: number
    testes: number
    extras: number
    despesasVaga: number
  }
  totalFilteredCandidates: number
  clientes: { id: string; nome: string }[]
}

export const getIndicatorsSummary = async (params: {
  month?: string
  periodStart?: string
  periodEnd?: string
  clientId?: string
  alertThreshold?: number
}): Promise<IndicatorsSummary> => {
  const query = new URLSearchParams()
  if (params.month) query.set('month', params.month)
  if (params.periodStart) query.set('periodStart', params.periodStart)
  if (params.periodEnd) query.set('periodEnd', params.periodEnd)
  if (params.clientId && params.clientId !== 'ALL') query.set('clientId', params.clientId)
  if (params.alertThreshold != null) query.set('alertThreshold', String(params.alertThreshold))

  return pb.send(`/backend/v1/indicators/summary?${query.toString()}`, { method: 'GET' })
}
