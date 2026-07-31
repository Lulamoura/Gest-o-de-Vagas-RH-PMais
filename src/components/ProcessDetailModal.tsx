import { type ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
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
        <span className="text-[11px] font-semibold text-slate-400 uppercase block tracking-wider">
          {label}
        </span>
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
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
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
  return cnParts.length > 0 && cnParts.every((p) => pn.includes(p))
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
      <DialogContent className="max-w-2xl w-full max-h-[85vh] flex flex-col p-0 overflow-hidden sm:rounded-xl">
        <DialogHeader className="px-6 py-4 border-b border-slate-200 shrink-0 bg-white z-10">
          <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Scale className="h-5 w-5 text-indigo-600" />
            Capa do Processo
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 break-all font-mono mt-0.5">
            {processoNumero || '—'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              <span className="text-sm font-medium">Buscando capa do processo...</span>
              <span className="text-xs text-slate-400">Consultando a API Escavador.</span>
            </div>
          )}

          {!loading && (error || !processData || processData?.error) && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-rose-600">
              <AlertCircle className="h-10 w-10 text-rose-600" />
              <span className="text-sm font-semibold text-center px-4 text-rose-600">
                {error || 'Não foi possível carregar os detalhes do processo.'}
              </span>
            </div>
          )}

          {!loading && !error && processData && !processData.error && (
            <>
              <CapaSection icon={<Building2 className="h-4 w-4" />} title="Tribunal">
                <div className="space-y-3">
                  <InfoRow
                    icon={<Building2 className="h-4 w-4" />}
                    label="Tribunal"
                    value={tribunalInfo?.display || '—'}
                  />
                  {vara !== '—' && (
                    <InfoRow
                      icon={<MapPin className="h-4 w-4" />}
                      label="Vara / Órgão Julgador"
                      value={vara}
                    />
                  )}
                </div>
              </CapaSection>

              <CapaSection icon={<FileText className="h-4 w-4" />} title="Classe Processual">
                <InfoRow icon={<FileText className="h-4 w-4" />} label="Classe" value={classe} />
              </CapaSection>

              <CapaSection icon={<Tag className="h-4 w-4" />} title="Assuntos">
                <div className="text-sm text-slate-700 leading-relaxed">
                  {assuntos !== '—' ? (
                    <div className="flex flex-wrap gap-1.5">
                      {assuntos.split(/[,;]/).map((a, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="bg-slate-50 text-slate-700 border-slate-200 font-normal text-xs py-1 px-3 rounded-full"
                        >
                          {a.trim()}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-400 text-xs">Nenhum assunto informado.</span>
                  )}
                </div>
              </CapaSection>

              <CapaSection icon={<Calendar className="h-4 w-4" />} title="Data de Distribuição">
                <div className="space-y-3">
                  <InfoRow
                    icon={<Calendar className="h-4 w-4" />}
                    label="Distribuição"
                    value={dataDistribuicao}
                  />
                  {valorCausa !== '—' && (
                    <InfoRow
                      icon={<Banknote className="h-4 w-4" />}
                      label="Valor da Causa"
                      value={valorCausa}
                    />
                  )}
                </div>
              </CapaSection>

              <CapaSection icon={<Users className="h-4 w-4" />} title="Partes Envolvidas">
                {partes.length > 0 ? (
                  <div className="space-y-2.5">
                    {partes.map((parte, i) => {
                      const isCandidate = isCandidateMatch(parte.nome, candidateNome)
                      return (
                        <div
                          key={i}
                          className={`flex flex-col gap-1.5 rounded-lg border p-3 transition-colors ${
                            isCandidate
                              ? 'border-indigo-200 bg-indigo-50/70'
                              : 'border-slate-100 bg-slate-50/60'
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-900">
                              {parte.nome}
                            </span>
                            {parte.tipo && (
                              <Badge
                                variant="outline"
                                className={`text-[11px] font-medium h-5 px-2 border-0 ${
                                  isCandidate
                                    ? 'bg-indigo-100 text-indigo-700'
                                    : 'bg-slate-200/70 text-slate-700'
                                }`}
                              >
                                {parte.tipo}
                              </Badge>
                            )}
                            {isCandidate && (
                              <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-medium h-5 px-2 gap-1">
                                <User className="h-3 w-3" /> Candidato
                              </Badge>
                            )}
                          </div>
                          {parte.advogados && parte.advogados.length > 0 && (
                            <div className="text-xs text-slate-600">
                              <span className="font-semibold text-slate-500">Advogados: </span>
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
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
