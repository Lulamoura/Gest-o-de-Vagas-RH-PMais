import { useState, useEffect } from 'react'
import { getCandidates, deleteCandidate } from '@/services/candidates'
import { getVacancies } from '@/services/vacancies'
import { getClinicas } from '@/services/clinicas'
import { CandidateRecord, VacancyRecord, VacancyStatus, ClinicaRecord } from '@/types'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { useSystemParameters } from '@/hooks/use-system-parameters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StarRating } from '@/components/StarRating'
import { CandidateEditModal } from '@/components/CandidateEditModal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { getCandidateStatusBadgeClass } from '@/lib/status-utils'
import { toast } from 'sonner'
import { Plus, Search, Pencil, Trash2, Eye, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { OverdueVacancyIcon } from '@/components/OverdueVacancyIcon'
import { isVacancyOverdue } from '@/lib/vacancy-overdue'

const ALL_STATUSES = [
  'Análise do RH',
  'Análise do gestor',
  'Documentação e exame',
  'Cadastro DP',
  'Integrado',
  'Desistente',
  'Desclassificado',
  'Em banco',
]

export default function Candidates() {
  const navigate = useNavigate()
  const { isAdmin, isSuperAdmin } = useAuth()
  const { parameters } = useSystemParameters()
  const alertThreshold = parameters?.prazo_alerta_dias ?? 30
  const canEdit = isAdmin || isSuperAdmin

  const [candidates, setCandidates] = useState<CandidateRecord[]>([])
  const [vacancies, setVacancies] = useState<VacancyRecord[]>([])
  const [, setClinicas] = useState<ClinicaRecord[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [vacancyFilter, setVacancyFilter] = useState<string>('all')
  const [vacancyStatusFilter, setVacancyStatusFilter] = useState<VacancyStatus | 'all'>('Aberta')

  const [editOpen, setEditOpen] = useState(false)
  const [editingCandidate, setEditingCandidate] = useState<CandidateRecord | null>(null)

  const [candidateToDelete, setCandidateToDelete] = useState<CandidateRecord | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const loadData = async () => {
    try {
      const [cList, vList, clList] = await Promise.all([
        getCandidates(),
        getVacancies(),
        getClinicas(),
      ])
      setCandidates(cList)
      setVacancies(vList)
      setClinicas(clList)
    } catch {
      toast.error('Erro ao carregar candidatos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('candidates', () => loadData())

  const openNewModal = () => {
    setEditingCandidate(null)
    setEditOpen(true)
  }

  const openEditModal = (c: CandidateRecord) => {
    setEditingCandidate(c)
    setEditOpen(true)
  }

  const promptDelete = (c: CandidateRecord) => {
    setCandidateToDelete(c)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!candidateToDelete) return
    setDeleting(true)
    try {
      await deleteCandidate(candidateToDelete.id)
      toast.success('Candidato excluído!')
      setDeleteDialogOpen(false)
      setCandidateToDelete(null)
      loadData()
    } catch {
      toast.error('Erro ao excluir candidato')
    } finally {
      setDeleting(false)
    }
  }

  const filteredCandidates = candidates.filter((c) => {
    const matchesSearch =
      !search ||
      c.nome.toLowerCase().includes(search.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
      (c.cpf && c.cpf.includes(search))

    const matchesStatus = statusFilter === 'all' || c.status_candidato === statusFilter
    const matchesVacancy = vacancyFilter === 'all' || c.vacancy_id === vacancyFilter
    const matchesVacancyStatus =
      vacancyStatusFilter === 'all' ||
      (c.vacancy_id != null && c.expand?.vacancy_id?.status_vaga === vacancyStatusFilter)

    return matchesSearch && matchesStatus && matchesVacancy && matchesVacancyStatus
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestão de Candidatos</h1>
          <p className="text-slate-500 text-xs mt-1">
            Cadastre, edite e acompanhe o pipeline de candidatos do RH.
          </p>
        </div>
        {canEdit && (
          <Button
            onClick={openNewModal}
            className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xs"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Candidato
          </Button>
        )}
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por nome, e-mail ou CPF..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>
            <Select value={vacancyFilter} onValueChange={setVacancyFilter}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Todas as vagas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as vagas</SelectItem>
                {vacancies.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.expand?.cargo?.nome || v.expand?.cliente?.nome || v.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {ALL_STATUSES.map((st) => (
                  <SelectItem key={st} value={st}>
                    {st}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={vacancyStatusFilter}
              onValueChange={(val) => setVacancyStatusFilter(val as VacancyStatus | 'all')}
            >
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Status da vaga" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="Aberta">Aberta</SelectItem>
                <SelectItem value="Concluída">Concluída</SelectItem>
                <SelectItem value="Cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : filteredCandidates.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="p-8 text-center text-slate-500 text-sm">
            Nenhum candidato encontrado.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCandidates.map((c) => {
            const vacancy = c.expand?.vacancy_id
            return (
              <Card key={c.id} className="border-slate-200 hover:border-slate-300 transition-all">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900 line-clamp-1">
                        {c.nome}
                      </CardTitle>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        {vacancy && isVacancyOverdue(vacancy, alertThreshold) && (
                          <OverdueVacancyIcon iconClassName="h-3.5 w-3.5" />
                        )}
                        {vacancy?.expand?.cargo?.nome || vacancy?.expand?.cliente?.nome || '—'}
                      </p>
                    </div>
                    {c.rank != null && <StarRating value={c.rank} readOnly size={12} />}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="text-xs space-y-1 text-slate-600">
                    {c.email && <p className="truncate">E-mail: {c.email}</p>}
                    {c.telefone && <p>Tel: {c.telefone}</p>}
                    {c.cpf && <p>CPF: {c.cpf}</p>}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <Badge
                      variant="outline"
                      className={getCandidateStatusBadgeClass(c.status_candidato)}
                    >
                      {c.status_candidato}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/candidatos/${c.id}`)}
                        className="h-7 w-8 p-0 text-slate-500 hover:text-slate-900"
                        title="Ver Detalhes"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(c)}
                            className="h-7 w-8 p-0 text-slate-500 hover:text-indigo-600"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => promptDelete(c)}
                            className="h-7 w-8 p-0 text-slate-500 hover:text-rose-600"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <CandidateEditModal
        open={editOpen}
        onOpenChange={setEditOpen}
        candidate={editingCandidate}
        vacancies={vacancies}
        onSaved={loadData}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Confirmação de Exclusão"
        description="Deseja realmente excluir este candidato?"
        confirmText="Confirmar"
        cancelText="Cancelar"
        variant="destructive"
        loading={deleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
