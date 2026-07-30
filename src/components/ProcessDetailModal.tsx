import { type ReactNode } from 'react'
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
  getTribunalInfo,
  getProcessClass,
  getProcessAssunto,
  getProcessData,
  getProcessPartes,
  getProcessVara,
  getProcessValorCausa,
} from '@/lib/legal-utils'
import {
  Scale,
  Loader2,
  AlertCircle,
  Building2,
  FileText,
  Tag,
  Calendar,
  Users,
  User,
  Banknote,
  MapPin,
} from 'lucide-react'

interface Props {
  processData: any | null
  processoNumero: string
  candidateNome?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  loading?: boolean
  error?: string | null
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="text-indigo-600 mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <span className="text-[11px] font-semibold text-slate-400 uppercase block">{label}</span>
        <span className="text-sm text-slate-800 font-medium break-words">{value}</span>
      </div>
    </div>
  )
}

function CapaSection({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-indigo-600">{icon}</span>
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function isCandidateMatch(parteNome: string, candidateNome?: string): boolean {
  if (!candidateNome || !parteNome) return false
  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
  const cn = normalize(candidateNome)
  const pn = normalize(parteNome)
  if (pn === cn) return true
  if (cn.length > 3 && pn.includes(cn)) return true
  if (pn.length > 3 && cn.includes(pn)) return true
  const cnParts = cn.split(' ').filter((p) => p.length > 2)
  return cnParts.every((p) => pn.includes(p))
}

export function ProcessDetailModal({
  processData,
  processoNumero,
  candidateNome,
  open,
  onOpenChange,
  loading,
  error,
}: Props) {
  const tribunalInfo = processData ? getTribunalInfo(processData) : null
  const classe = processData ? getProcessClass(processData) : '—'
  const assuntos = processData ? getProcessAssunto(processData) : '—'
  const dataDistribuicao = processData ? getProcessData(processData) : '—'
  const vara = processData ? getProcessVara(processData) : '—'
  const valorCausa = processData ? getProcessValorCausa(processData) : '—'
  const partes = processData ? getProcessPartes(processData) : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b border-slate-200 shrink-0">
          <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Scale className="h-5 w-5 text-indigo-600" />
            Capa do Processo
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 break-all font-mono">
            {processoNumero || '—'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col p-6">
          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              <span className="text-sm font-medium">Buscando capa do processo...</span>
              <span className="text-xs text-slate-400">Consultando a API Escavador.</span>
            </div>
          )}

          {!loading && (error || !processData || processData?.error) && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12 text-rose-600">
              <AlertCircle className="h-10 w-10 text-rose-600" />
              <span className="text-sm font-semibold text-center px-4 text-rose-600">
                Não foi possível carregar os detalhes do processo.
              </span>
            </div>
          )}

          {!loading && !error && processData && !processData.error && (
            <ScrollArea className="flex-1 pr-2">
              <div className="space-y-4">
                <CapaSection icon={<Building2 className="h-4 w-4" />} title="Tribunal">
                  <div className="space-y-2.5">
                    <InfoRow
                      icon={<Building2 className="h-4 w-4" />}
                      label="Tribunal"
                      value={tribunalInfo?.display || '—'}
                    />
                    {tribunalInfo?.nome && tribunalInfo.nome !== tribunalInfo.sigla && (
                      <InfoRow
                        icon={<MapPin className="h-4 w-4" />}
                        label="Vara / Órgão"
                        value={vara}
                      />
                    )}
                  </div>
                </CapaSection>

                <CapaSection icon={<FileText className="h-4 w-4" />} title="Classe Processual">
                  <InfoRow icon={<FileText className="h-4 w-4" />} label="Classe" value={classe} />
                </CapaSection>

                <CapaSection icon={<Tag className="h-4 w-4" />} title="Assuntos">
                  <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {assuntos !== '—' ? (
                      assuntos.split(',').map((a, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="bg-slate-50 text-slate-700 border-slate-200 mr-1.5 mb-1.5"
                        >
                          {a.trim()}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-slate-400 text-xs">Nenhum assunto informado.</span>
                    )}
                  </div>
                </CapaSection>

                <CapaSection icon={<Calendar className="h-4 w-4" />} title="Data de Distribuição">
                  <div className="space-y-2.5">
                    <InfoRow
                      icon={<Calendar className="h-4 w-4" />}
                      label="Distribuição"
                      value={dataDistribuicao}
                    />
                    <InfoRow
                      icon={<Banknote className="h-4 w-4" />}
                      label="Valor da Causa"
                      value={valorCausa}
                    />
                  </div>
                </CapaSection>

                <CapaSection icon={<Users className="h-4 w-4" />} title="Partes Envolvidas">
                  {partes.length > 0 ? (
                    <div className="space-y-2">
                      {partes.map((parte, i) => {
                        const isCandidate = isCandidateMatch(parte.nome, candidateNome)
                        return (
                          <div
                            key={i}
                            className={`flex flex-col gap-1 rounded-lg border p-2.5 transition-colors ${
                              isCandidate
                                ? 'border-indigo-300 bg-indigo-50/70'
                                : 'border-slate-100 bg-slate-50/60'
                            }`}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-slate-800">
                                {parte.nome}
                              </span>
                              {parte.tipo && (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] h-5 ${
                                    isCandidate
                                      ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                                      : 'bg-slate-100 text-slate-600 border-slate-200'
                                  }`}
                                >
                                  {parte.tipo}
                                </Badge>
                              )}
                              {isCandidate && (
                                <Badge className="bg-indigo-600 text-white text-[10px] h-5 gap-0.5">
                                  <User className="h-2.5 w-2.5" /> Candidato
                                </Badge>
                              )}
                            </div>
                            {parte.advogados.length > 0 && (
                              <div className="text-xs text-slate-500 pl-1">
                                <span className="font-medium">Advogados: </span>
                                {parte.advogados.join(', ')}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 text-center py-2">
                      Nenhuma parte encontrada nos dados do processo.
                    </p>
                  )}
                </CapaSection>
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
