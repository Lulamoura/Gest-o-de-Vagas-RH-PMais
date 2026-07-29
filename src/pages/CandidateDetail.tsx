import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getCandidate } from '@/services/candidates'
import { CandidateRecord } from '@/types'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { CandidateLegalConsultation } from '@/components/CandidateLegalConsultation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, getCandidateStatusBadgeClass } from '@/lib/status-utils'
import { ArrowLeft, Mail, Phone, MapPin, CreditCard, Briefcase } from 'lucide-react'
import { StarRating } from '@/components/StarRating'
import { toast } from 'sonner'

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAdmin, isSuperAdmin } = useAuth()
  const canConsult = isAdmin || isSuperAdmin

  const [candidate, setCandidate] = useState<CandidateRecord | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    if (!id) return
    try {
      const data = await getCandidate(id)
      setCandidate(data)
    } catch {
      toast.error('Erro ao carregar candidato')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  useRealtime('candidates', () => loadData())
  useRealtime('candidato_consultas_juridicas', () => loadData())

  if (loading || !candidate) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    )
  }

  const vacancy = candidate.expand?.vacancy_id
  const totalCost =
    (candidate.custo_consultas || 0) +
    (candidate.custo_exames || 0) +
    (candidate.custo_testes || 0) +
    (candidate.custo_extras || 0)

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        onClick={() => navigate('/candidatos')}
        className="text-slate-600 self-start"
      >
        <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para Candidatos
      </Button>

      <Card className="border-slate-200 shadow-2xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-bold text-slate-900">{candidate.nome}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-400" />
              <span className="text-slate-700">{candidate.email || '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-slate-400" />
              <span className="text-slate-700">{candidate.telefone || '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-slate-400" />
              <span className="text-slate-700">{candidate.cpf || '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-400" />
              <span className="text-slate-700">
                {[candidate.cidade, candidate.bairro].filter(Boolean).join(' - ') || '—'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-slate-400" />
              <span className="text-slate-700">
                {vacancy?.expand?.cargo?.nome || vacancy?.expand?.cliente?.nome || '—'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-semibold">Custo total:</span>
              <span className="text-slate-700 font-bold">{formatCurrency(totalCost)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
            <Badge
              variant="outline"
              className={getCandidateStatusBadgeClass(candidate.status_candidato)}
            >
              {candidate.status_candidato}
            </Badge>
            {candidate.rank != null && <StarRating value={candidate.rank} readOnly size={14} />}
          </div>
        </CardContent>
      </Card>

      <CandidateLegalConsultation
        candidateId={candidate.id}
        cpf={candidate.cpf}
        nome={candidate.nome}
        canConsult={canConsult}
      />
    </div>
  )
}
