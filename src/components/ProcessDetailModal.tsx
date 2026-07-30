import { type ReactNode } from 'react'
import { type ProcessAnalysis } from '@/services/candidato_consultas_juridicas'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ShieldAlert,
  Users,
  FileText,
  Scale,
  Loader2,
  AlertCircle,
  ShieldCheck,
  ShieldX,
  ClipboardCheck,
} from 'lucide-react'

interface Props {
  analysisData: ProcessAnalysis | null
  processoNumero: string
  open: boolean
  onOpenChange: (open: boolean) => void
  loading?: boolean
  error?: string | null
}

type RiskLevel = 'Baixo' | 'Médio' | 'Alto' | 'Indefinido'
type Recommendation = 'aprovar' | 'reprovar' | 'indefinido'

function getRiskLevel(risco: string): RiskLevel {
  const lower = risco.toLowerCase()
  if (lower.includes('alto')) return 'Alto'
  if (lower.includes('médio') || lower.includes('medio')) return 'Médio'
  if (lower.includes('baixo')) return 'Baixo'
  return 'Indefinido'
}

function getRecommendation(rec: string): Recommendation {
  const lower = rec.toLowerCase()
  if (lower.includes('reprovar') || lower.includes('reprov')) return 'reprovar'
  if (lower.includes('aprovar') || lower.includes('aprov')) return 'aprovar'
  return 'indefinido'
}

function AnalysisSection({
  icon,
  title,
  children,
  accent,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
  accent?: string
}) {
  return (
    <div className={`rounded-xl border p-4 ${accent || 'border-slate-200 bg-white'}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      </div>
      <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{children}</div>
    </div>
  )
}

export function ProcessDetailModal({
  analysisData,
  processoNumero,
  open,
  onOpenChange,
  loading,
  error,
}: Props) {
  const riskLevel: RiskLevel = analysisData
    ? getRiskLevel(analysisData.analise_risco)
    : 'Indefinido'
  const recommendation: Recommendation = analysisData
    ? getRecommendation(analysisData.recomendacao_rh)
    : 'indefinido'

  const riskBadgeClass =
    riskLevel === 'Alto'
      ? 'bg-rose-100 text-rose-700 border-rose-200'
      : riskLevel === 'Médio'
        ? 'bg-amber-100 text-amber-700 border-amber-200'
        : riskLevel === 'Baixo'
          ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
          : 'bg-slate-100 text-slate-600 border-slate-200'

  const riskSectionAccent =
    riskLevel === 'Alto'
      ? 'border-rose-200 bg-rose-50/40'
      : riskLevel === 'Médio'
        ? 'border-amber-200 bg-amber-50/40'
        : riskLevel === 'Baixo'
          ? 'border-emerald-200 bg-emerald-50/40'
          : 'border-slate-200 bg-white'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b border-slate-200 shrink-0">
          <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Scale className="h-5 w-5 text-indigo-600" />
            Análise Detalhada
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 break-all font-mono">
            {processoNumero || '—'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col p-6">
          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              <span className="text-sm font-medium">Gerando análise detalhada via IA...</span>
              <span className="text-xs text-slate-400">Isso pode levar alguns segundos.</span>
            </div>
          )}

          {!loading && error && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-rose-600">
              <AlertCircle className="h-8 w-8" />
              <span className="text-sm font-medium text-center px-4">{error}</span>
            </div>
          )}

          {!loading && !error && analysisData && (
            <ScrollArea className="flex-1 pr-2">
              <div className="space-y-4">
                <div
                  className={`rounded-xl p-4 border-2 ${
                    recommendation === 'aprovar'
                      ? 'border-emerald-300 bg-emerald-50'
                      : recommendation === 'reprovar'
                        ? 'border-rose-300 bg-rose-50'
                        : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {recommendation === 'aprovar' ? (
                      <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    ) : recommendation === 'reprovar' ? (
                      <ShieldX className="h-5 w-5 text-rose-600" />
                    ) : (
                      <ClipboardCheck className="h-5 w-5 text-slate-500" />
                    )}
                    <h3 className="text-sm font-bold text-slate-900">Recomendação RH</h3>
                    {recommendation !== 'indefinido' && (
                      <Badge
                        variant="outline"
                        className={`ml-auto ${
                          recommendation === 'aprovar'
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                            : 'bg-rose-100 text-rose-700 border-rose-300'
                        }`}
                      >
                        {recommendation === 'aprovar' ? 'APROVAR' : 'REPROVAR'}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {analysisData.recomendacao_rh}
                  </p>
                </div>

                <AnalysisSection
                  icon={<ShieldAlert className="h-4 w-4 text-indigo-600" />}
                  title="Análise de Risco"
                  accent={riskSectionAccent}
                >
                  <div className="mb-2">
                    <Badge variant="outline" className={riskBadgeClass}>
                      Risco {riskLevel}
                    </Badge>
                  </div>
                  {analysisData.analise_risco}
                </AnalysisSection>

                <AnalysisSection
                  icon={<Users className="h-4 w-4 text-indigo-600" />}
                  title="Detalhamento de Partes"
                >
                  {analysisData.detalhamento_partes}
                </AnalysisSection>

                <AnalysisSection
                  icon={<FileText className="h-4 w-4 text-indigo-600" />}
                  title="Movimentações Relevantes"
                >
                  {analysisData.movimentacoes_relevantes}
                </AnalysisSection>
              </div>
            </ScrollArea>
          )}

          {!loading && !error && !analysisData && (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
              Nenhuma análise disponível.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
