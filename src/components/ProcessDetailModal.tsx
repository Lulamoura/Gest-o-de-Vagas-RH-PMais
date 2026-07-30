import { useState, useEffect, useCallback } from 'react'
import { getProcessoDetalhes } from '@/services/candidato_consultas_juridicas'
import {
  getField,
  getNestedField,
  getTribunalInfo,
  getProcessClass,
  getProcessData,
  formatDateTime,
} from '@/lib/legal-utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  Gavel,
  Users,
  FileText,
  Info,
  Calendar,
  DollarSign,
  Scale,
} from 'lucide-react'

interface Props {
  numeroProcesso: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ProcessDetail {
  [key: string]: any
}

interface Party {
  nome: string
  tipo: string
  categoria?: string
}

export function ProcessDetailModal({ numeroProcesso, open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<ProcessDetail | null>(null)

  const fetchData = useCallback(async (processNum: string) => {
    setLoading(true)
    setError(null)
    setDetail(null)
    try {
      const result = await getProcessoDetalhes(processNum)
      setDetail(result)
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar os detalhes do processo.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && numeroProcesso) {
      fetchData(numeroProcesso)
    } else {
      setDetail(null)
      setError(null)
      setLoading(false)
    }
  }, [open, numeroProcesso, fetchData])

  const handleRetry = () => {
    if (numeroProcesso) fetchData(numeroProcesso)
  }

  const renderParties = (data: any): Party[] => {
    const parties: Party[] = []

    if (Array.isArray(data.partes)) {
      for (const p of data.partes) {
        if (!p || typeof p !== 'object') continue
        parties.push({
          nome: getField(p, 'nome', 'razao_social', 'nome_completo'),
          tipo: getField(p, 'tipo', 'tipo_parte', 'categoria', 'qualificacao'),
          categoria: getNestedField(p, 'pessoa.tipo', 'pessoa.categoria'),
        })
      }
    }

    if (Array.isArray(data.envolvidos)) {
      for (const p of data.envolvidos) {
        if (!p || typeof p !== 'object') continue
        parties.push({
          nome: getField(p, 'nome', 'razao_social'),
          tipo: getField(p, 'tipo', 'tipo_envolvido', 'qualificacao', 'relacao'),
          categoria: getNestedField(p, 'pessoa.tipo'),
        })
      }
    }

    if (Array.isArray(data.capa?.partes)) {
      for (const p of data.capa.partes) {
        if (!p || typeof p !== 'object') continue
        parties.push({
          nome: getField(p, 'nome', 'razao_social'),
          tipo: getField(p, 'tipo', 'tipo_parte', 'qualificacao'),
          categoria: getNestedField(p, 'pessoa.tipo'),
        })
      }
    }

    return parties
  }

  const renderMovements = (data: any): { data: string; descricao: string }[] => {
    const movements: { data: string; descricao: string }[] = []

    if (Array.isArray(data.movimentos)) {
      for (const m of data.movimentos) {
        if (!m || typeof m !== 'object') continue
        movements.push({
          data: getField(m, 'data', 'data_movimento', 'data_hora') || '—',
          descricao: getField(m, 'descricao', 'nome', 'titulo', 'complemento'),
        })
      }
    }

    if (Array.isArray(data.andamentos)) {
      for (const m of data.andamentos) {
        if (!m || typeof m !== 'object') continue
        movements.push({
          data: getField(m, 'data', 'data_andamento', 'data_hora') || '—',
          descricao: getField(m, 'descricao', 'nome', 'titulo', 'conteudo'),
        })
      }
    }

    return movements
  }

  const numero = detail
    ? getField(detail, 'numero_cnj', 'numero', 'numero_processo', 'titulo')
    : numeroProcesso || '—'
  const tribunalInfo = detail ? getTribunalInfo(detail) : { display: '—' }
  const classe = detail ? getProcessClass(detail) : '—'
  const dataAjuiz = detail ? getProcessData(detail) : '—'
  const statusProc = detail ? getField(detail, 'status', 'situacao') : '—'
  const valorCausa = detail
    ? getNestedField(detail, 'valor_causa', 'capa.valor_causa', 'valor', 'capa.valor')
    : '—'
  const juiz = detail ? getNestedField(detail, 'juiz', 'capa.juiz', 'magistrado') : '—'
  const orgaoJulgador = detail
    ? getNestedField(detail, 'capa.orgao_julgador', 'orgao_julgador', 'vara')
    : '—'
  const assunto = detail
    ? getNestedField(detail, 'assunto', 'capa.assunto', 'assunto_principal')
    : '—'

  const parties = detail ? renderParties(detail) : []
  const movements = detail ? renderMovements(detail) : []

  const formatValor = (val: string): string => {
    if (!val || val === '—') return '—'
    try {
      const num = parseFloat(
        val
          .replace(/[^\d.,]/g, '')
          .replace(/\./g, '')
          .replace(',', '.'),
      )
      if (!isNaN(num)) {
        return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      }
    } catch {
      /* noop */
    }
    return val
  }

  const formatDateMov = (d: string): string => {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b border-slate-200 shrink-0">
          <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Scale className="h-5 w-5 text-indigo-600" />
            Detalhes do Processo
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 break-all">
            {numero}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              <p className="text-sm text-slate-500">Carregando detalhes do processo...</p>
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="flex items-center gap-2 text-rose-600 bg-rose-50 p-4 rounded-lg border border-rose-200 max-w-md">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span className="text-sm text-rose-700">{error}</span>
              </div>
              <Button
                onClick={handleRetry}
                variant="outline"
                className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              >
                <RefreshCw className="h-4 w-4 mr-2" /> Tentar novamente
              </Button>
            </div>
          )}

          {!loading && !error && detail && (
            <div className="space-y-6 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
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

              <section>
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5 mb-3">
                  <Info className="h-4 w-4 text-indigo-600" /> Informações Gerais
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <InfoRow label="Número CNJ" value={numero} />
                  <InfoRow label="Tribunal" value={tribunalInfo.display} />
                  <InfoRow label="Classe" value={classe} />
                  <InfoRow label="Assunto" value={assunto} />
                  <InfoRow label="Juiz" value={juiz} />
                  <InfoRow label="Órgão Julgador" value={orgaoJulgador} />
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
              </section>

              {parties.length > 0 && (
                <section>
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5 mb-3">
                    <Users className="h-4 w-4 text-indigo-600" /> Partes Envolvidas
                  </h3>
                  <div className="space-y-2">
                    {parties.map((p, i) => (
                      <div
                        key={i}
                        className="flex items-start justify-between gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-semibold text-slate-800 break-words block">
                            {p.nome}
                          </span>
                          {p.categoria && p.categoria !== '—' && (
                            <span className="text-[11px] text-slate-400">{p.categoria}</span>
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
                    ))}
                  </div>
                </section>
              )}

              {movements.length > 0 && (
                <section>
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5 mb-3">
                    <FileText className="h-4 w-4 text-indigo-600" /> Movimentações (
                    {movements.length})
                  </h3>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                    {movements.map((m, i) => (
                      <div
                        key={i}
                        className="flex gap-3 p-2.5 rounded-lg bg-white border border-slate-100"
                      >
                        <div className="shrink-0 w-20 text-[11px] text-slate-500 font-medium">
                          {formatDateMov(m.data)}
                        </div>
                        <div className="flex-1 text-xs text-slate-700 leading-relaxed">
                          {m.descricao}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {parties.length === 0 && movements.length === 0 && (
                <section>
                  <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 p-4 rounded-lg border border-dashed border-slate-200">
                    <Gavel className="h-4 w-4 text-slate-400 shrink-0" />
                    Informações adicionais de partes e movimentações não estão disponíveis para este
                    processo.
                  </div>
                </section>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col p-2.5 rounded-lg bg-slate-50 border border-slate-100">
      <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
        {icon}
        {label}
      </span>
      <span className="text-sm font-semibold text-slate-800 break-words">{value}</span>
    </div>
  )
}
