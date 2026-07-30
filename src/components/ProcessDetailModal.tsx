import {
  getField,
  getNestedField,
  getTribunalInfo,
  getProcessClass,
  getProcessData,
  getProcessAssunto,
  getProcessVara,
  getProcessNumber,
  getProcessValorCausa,
  getProcessJuiz,
  getProcessStatus,
  formatCNJNumber,
} from '@/lib/legal-utils'
import { parseParties, parseMovements, type Party, type Movement } from '@/lib/process-utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Gavel,
  Users,
  FileText,
  Info,
  Calendar,
  DollarSign,
  Scale,
  Loader2,
  AlertCircle,
} from 'lucide-react'

interface Props {
  processData: any | null
  open: boolean
  onOpenChange: (open: boolean) => void
  loading?: boolean
  error?: string | null
}

function formatDateMov(d: string): string {
  if (!d || d === '—') return '—'
  if (d.includes('T') || d.match(/^\d{4}-\d{2}-\d{2}/)) {
    try {
      const [datePart] = d.split('T')
      const [yyyy, mm, dd] = datePart.split('-')
      if (yyyy && mm && dd) return `${dd}/${mm}/${yyyy}`
    } catch {
      /* noop */
    }
  }
  return d
}

function formatValor(val: string): string {
  if (!val || val === '—') return '—'
  try {
    const num = parseFloat(
      val
        .replace(/[^\d.,]/g, '')
        .replace(/\./g, '')
        .replace(',', '.'),
    )
    if (!isNaN(num)) return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  } catch {
    /* noop */
  }
  return val
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col p-2.5 rounded-lg bg-slate-50 border border-slate-100">
      <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1 mb-0.5">
        {icon}
        {label}
      </span>
      <span className="text-xs font-semibold text-slate-800 break-words">{value}</span>
    </div>
  )
}

function PartyItem({ p }: { p: Party }) {
  return (
    <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
      <div className="min-w-0 flex-1">
        <span className="text-sm font-semibold text-slate-800 break-words block">{p.nome}</span>
        {p.categoria && p.categoria !== '—' && (
          <span className="text-[11px] text-slate-400 block mt-0.5">{p.categoria}</span>
        )}
      </div>
      {p.tipo !== '—' && (
        <Badge
          variant="outline"
          className="bg-white text-slate-600 border-slate-200 text-[11px] shrink-0"
        >
          {p.tipo}
        </Badge>
      )}
    </div>
  )
}

function MovementItem({ m }: { m: Movement }) {
  return (
    <div className="flex gap-3 p-3 rounded-lg bg-white border border-slate-100 hover:border-slate-200 transition-colors">
      <div className="shrink-0 w-24 text-[11px] text-slate-500 font-medium">
        {formatDateMov(m.data)}
      </div>
      <div className="flex-1 text-xs text-slate-700 leading-relaxed break-words">{m.descricao}</div>
    </div>
  )
}

export function ProcessDetailModal({ processData, open, onOpenChange, loading, error }: Props) {
  const realDetail = processData?.resposta || processData?.data || processData

  const procNumDisplay = realDetail
    ? getProcessNumber(realDetail) !== '—'
      ? getProcessNumber(realDetail)
      : formatCNJNumber(getField(realDetail, 'numero_cnj', 'numero', 'numero_processo', 'titulo'))
    : '—'

  const tribunalInfo = realDetail ? getTribunalInfo(realDetail) : { display: '—' }
  const classe = realDetail ? getProcessClass(realDetail) : '—'
  const dataAjuiz = realDetail ? getProcessData(realDetail) : '—'
  const statusProc = realDetail ? getProcessStatus(realDetail) : '—'
  const valorCausa = realDetail ? getProcessValorCausa(realDetail) : '—'
  const juiz = realDetail ? getProcessJuiz(realDetail) : '—'
  const orgaoJulgador = realDetail ? getProcessVara(realDetail) : '—'
  const assunto = realDetail ? getProcessAssunto(realDetail) : '—'
  const parties = realDetail ? parseParties(realDetail) : []
  const movements = realDetail ? parseMovements(realDetail) : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b border-slate-200 shrink-0">
          <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Scale className="h-5 w-5 text-indigo-600" />
            Detalhes do Processo
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 break-all font-mono">
            {procNumDisplay}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col p-6">
          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              <span className="text-sm font-medium">Carregando detalhes do processo...</span>
            </div>
          )}
          {!loading && error && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-rose-600">
              <AlertCircle className="h-8 w-8" />
              <span className="text-sm font-medium text-center px-4">{error}</span>
            </div>
          )}
          {!loading && !error && realDetail && (
            <Tabs defaultValue="geral" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="grid w-full grid-cols-3 mb-4 shrink-0 bg-slate-100">
                <TabsTrigger
                  value="geral"
                  className="text-xs font-semibold flex items-center gap-1.5"
                >
                  <Info className="h-3.5 w-3.5" /> Visão Geral
                </TabsTrigger>
                <TabsTrigger
                  value="partes"
                  className="text-xs font-semibold flex items-center gap-1.5"
                >
                  <Users className="h-3.5 w-3.5" /> Partes ({parties.length})
                </TabsTrigger>
                <TabsTrigger
                  value="movimentacoes"
                  className="text-xs font-semibold flex items-center gap-1.5"
                >
                  <FileText className="h-3.5 w-3.5" /> Movimentações ({movements.length})
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 pr-2">
                <TabsContent value="geral" className="mt-0 space-y-4">
                  <div className="flex flex-wrap items-center gap-2 pb-1">
                    <Badge
                      variant="outline"
                      className="bg-slate-50 text-slate-700 border-slate-200"
                    >
                      {tribunalInfo.display}
                    </Badge>
                    {statusProc !== '—' && (
                      <Badge
                        variant="outline"
                        className={
                          statusProc.toLowerCase().includes('inativo') ||
                          statusProc.toLowerCase().includes('arquiv')
                            ? 'bg-slate-100 text-slate-600 border-slate-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }
                      >
                        {statusProc}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <InfoRow label="Número CNJ" value={procNumDisplay} />
                    <InfoRow label="Tribunal" value={tribunalInfo.display} />
                    <InfoRow label="Classe" value={classe} />
                    <InfoRow label="Assunto" value={assunto} />
                    <InfoRow label="Juiz / Magistrado" value={juiz} />
                    <InfoRow label="Órgão Julgador / Vara" value={orgaoJulgador} />
                    <InfoRow
                      label="Distribuição"
                      value={dataAjuiz}
                      icon={<Calendar className="h-3 w-3 text-slate-400" />}
                    />
                    <InfoRow
                      label="Valor da Causa"
                      value={formatValor(valorCausa)}
                      icon={<DollarSign className="h-3 w-3 text-slate-400" />}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="partes" className="mt-0 space-y-2">
                  {parties.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 text-xs text-slate-500 bg-slate-50 p-6 rounded-lg border border-dashed border-slate-200">
                      <Users className="h-4 w-4 text-slate-400 shrink-0" />
                      Nenhuma parte registrada para este processo.
                    </div>
                  ) : (
                    parties.map((p, i) => <PartyItem key={i} p={p} />)
                  )}
                </TabsContent>

                <TabsContent value="movimentacoes" className="mt-0 space-y-2">
                  {movements.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 text-xs text-slate-500 bg-slate-50 p-6 rounded-lg border border-dashed border-slate-200">
                      <Gavel className="h-4 w-4 text-slate-400 shrink-0" />
                      Nenhuma movimentação registrada.
                    </div>
                  ) : (
                    movements.map((m, i) => <MovementItem key={i} m={m} />)
                  )}
                </TabsContent>
              </ScrollArea>
            </Tabs>
          )}
          {!loading && !error && !realDetail && (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
              Nenhum dado de processo disponível.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
