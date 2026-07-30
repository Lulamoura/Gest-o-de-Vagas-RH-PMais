import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle2, FileSpreadsheet } from 'lucide-react'

interface MandatoryIndicatorProps {
  candidatosEmProcesso: number
  totalPosicoes: number
  candidatosIntegrados: number
  compact?: boolean
}

function formatPercent(value: number): string {
  return value.toFixed(1).replace('.', ',')
}

export function MandatoryIndicatorCard({
  candidatosEmProcesso,
  totalPosicoes,
  candidatosIntegrados,
  compact = false,
}: MandatoryIndicatorProps) {
  const percentual = totalPosicoes > 0 ? (candidatosEmProcesso / totalPosicoes) * 100 : 0
  const taxa = totalPosicoes > 0 ? (candidatosIntegrados / totalPosicoes) * 100 : 0

  return (
    <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50/70 via-white to-purple-50/50 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

      <CardHeader className={compact ? 'pb-2 pt-4 px-4' : 'pb-2'}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-sm">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Indicador Obrigatório de RH (PMais)
              </CardTitle>
              <p className="text-xs text-slate-500 font-medium">
                Razão de vagas em seleção e candidatos integrados no pipeline
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="bg-white border-indigo-200 text-indigo-700 font-semibold px-2.5 py-1"
          >
            Meta RH
          </Badge>
        </div>
      </CardHeader>

      <CardContent className={compact ? 'px-4 pb-4' : 'pb-4'}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div className="bg-white/80 backdrop-blur border border-indigo-100 p-3.5 rounded-xl shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                RAZÃO DE VAGAS EM SELEÇÃO
              </span>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-extrabold text-slate-900">
                  {candidatosEmProcesso} / {totalPosicoes}
                </span>
                <span className="text-xs font-medium text-slate-500">
                  – {formatPercent(percentual)}%
                </span>
              </div>
            </div>
            {candidatosEmProcesso > 0 ? (
              <AlertCircle className="h-7 w-7 text-amber-500 shrink-0" />
            ) : (
              <CheckCircle2 className="h-7 w-7 text-emerald-500 shrink-0" />
            )}
          </div>

          <div className="bg-white/80 backdrop-blur border border-indigo-100 p-3.5 rounded-xl shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                CANDIDATOS INTEGRADOS NO PIPELINE
              </span>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-extrabold text-indigo-700">
                  {candidatosIntegrados} / {totalPosicoes}
                </span>
                <span className="text-xs font-medium text-slate-500">– {formatPercent(taxa)}%</span>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-indigo-100 text-indigo-800">
                {formatPercent(taxa)}% taxa
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
