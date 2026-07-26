import { useState, useEffect, useMemo } from 'react'
import { getCandidates, createCandidate, updateCandidate } from '@/services/candidates'
import { getVacancies } from '@/services/vacancies'
import { CandidateRecord, VacancyRecord, CandidateStatus } from '@/types'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCurrency, getCandidateStatusBadgeClass } from '@/lib/status-utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { CurrencyInput } from '@/components/CurrencyInput'
import {
  PlusCircle,
  Search,
  Pencil,
  Users,
  Briefcase,
  Filter,
  Star,
  ArrowUpDown,
} from 'lucide-react'
import { StarRating } from '@/components/StarRating'

export default function Candidates() {
  const [candidates, setCandidates] = useState<CandidateRecord[]>([])
  const [vacancies, setVacancies] = useState<VacancyRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [vacancyFilter, setVacancyFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [rankFilter, setRankFilter] = useState('ALL')
  const [sortByRank, setSortByRank] = useState<'asc' | 'desc' | null>(null)

  // Modal create/edit
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCandidate, setEditingCandidate] = useState<CandidateRecord | null>(null)

  // Form fields
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [vacancyId, setVacancyId] = useState('')
  const [statusCandidato, setStatusCandidato] = useState<CandidateStatus>('Em análise do gestor')
  const [custoConsultas, setCustoConsultas] = useState(0)
  const [custoExames, setCustoExames] = useState(0)
  const [custoTestes, setCustoTestes] = useState(0)
  const [custoExtras, setCustoExtras] = useState(0)
  const [rank, setRank] = useState<number | null>(null)
  const [rankError, setRankError] = useState('')
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    try {
      const [cData, vData] = await Promise.all([getCandidates(), getVacancies()])
      setCandidates(cData)
      setVacancies(vData)
    } catch (err) {
      toast.error('Erro ao carregar candidatos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('candidates', () => loadData())

  const filteredCandidates = useMemo(() => {
    const filtered = candidates.filter((c) => {
      const matchesSearch =
        search === '' ||
        c.nome.toLowerCase().includes(search.toLowerCase()) ||
        (c.email && c.email.toLowerCase().includes(search.toLowerCase()))

      const matchesVacancy = vacancyFilter === 'ALL' || c.vacancy_id === vacancyFilter
      const matchesStatus = statusFilter === 'ALL' || c.status_candidato === statusFilter

      const matchesRank = rankFilter === 'ALL' || (c.rank != null && c.rank >= Number(rankFilter))

      return matchesSearch && matchesVacancy && matchesStatus && matchesRank
    })

    if (sortByRank === 'desc') {
      filtered.sort((a, b) => (b.rank || 0) - (a.rank || 0))
    } else if (sortByRank === 'asc') {
      filtered.sort((a, b) => (a.rank || 0) - (b.rank || 0))
    }

    return filtered
  }, [candidates, search, vacancyFilter, statusFilter, rankFilter, sortByRank])

  const openCreateModal = () => {
    setEditingCandidate(null)
    setNome('')
    setEmail('')
    setTelefone('')
    setVacancyId(vacancies[0]?.id || '')
    setStatusCandidato('Em análise do gestor')
    setCustoConsultas(0)
    setCustoExames(0)
    setCustoTestes(0)
    setCustoExtras(0)
    setRank(null)
    setRankError('')
    setModalOpen(true)
  }

  const openEditModal = (c: CandidateRecord) => {
    setEditingCandidate(c)
    setNome(c.nome)
    setEmail(c.email || '')
    setTelefone(c.telefone || '')
    setVacancyId(c.vacancy_id)
    setStatusCandidato(c.status_candidato)
    setCustoConsultas(c.custo_consultas || 0)
    setCustoExames(c.custo_exames || 0)
    setCustoTestes(c.custo_testes || 0)
    setCustoExtras(c.custo_extras || 0)
    setRank(c.rank ?? null)
    setRankError('')
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim() || !vacancyId) {
      toast.error('Nome do candidato e vaga vinculada são obrigatórios.')
      return
    }

    if (rank != null && (rank < 1 || rank > 5 || !Number.isInteger(rank))) {
      setRankError('O ranking deve ser um valor entre 1 e 5 estrelas.')
      return
    }
    setRankError('')

    setSaving(true)
    const payload = {
      nome,
      email,
      telefone,
      vacancy_id: vacancyId,
      status_candidato: statusCandidato,
      custo_consultas: Number(custoConsultas),
      custo_exames: Number(custoExames),
      custo_testes: Number(custoTestes),
      custo_extras: Number(custoExtras),
      rank: rank ?? null,
    }

    try {
      if (editingCandidate) {
        await updateCandidate(editingCandidate.id, payload)
        toast.success('Candidato atualizado com sucesso!')
      } else {
        await createCandidate(payload)
        toast.success('Candidato criado com sucesso!')
      }
      setModalOpen(false)
      loadData()
    } catch (err) {
      toast.error('Erro ao salvar candidato')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Gestão de Candidatos</h2>
          <p className="text-xs text-slate-500">
            Acompanhe o status e custos de todos os candidatos participantes dos processos seletivos
          </p>
        </div>

        <Button
          onClick={openCreateModal}
          className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm"
        >
          <PlusCircle className="h-4 w-4 mr-2" /> Novo Candidato
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="border-slate-200 shadow-2xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
            <Filter className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              Filtros
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <Select value={vacancyFilter} onValueChange={setVacancyFilter}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Vaga Vinculada" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas as Vagas</SelectItem>
                {vacancies.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.expand?.cargo?.nome || v.cargo} ({v.expand?.cliente?.nome || v.cliente})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Status do Candidato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os Status</SelectItem>
                <SelectItem value="Em análise do gestor">Em análise do gestor</SelectItem>
                <SelectItem value="Pré-Aprovado">Pré-Aprovado</SelectItem>
                <SelectItem value="Integrado">Integrado</SelectItem>
                <SelectItem value="Desistiu">Desistiu</SelectItem>
                <SelectItem value="Não aprovado">Não aprovado</SelectItem>
                <SelectItem value="Rejeitado">Rejeitado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={rankFilter} onValueChange={setRankFilter}>
              <SelectTrigger className="h-9 text-xs">
                <Star className="h-3.5 w-3.5 mr-1.5 text-amber-400 fill-amber-400" />
                <SelectValue placeholder="Ranking" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os Rankings</SelectItem>
                <SelectItem value="1">Ranking ≥ 1 estrela</SelectItem>
                <SelectItem value="2">Ranking ≥ 2 estrelas</SelectItem>
                <SelectItem value="3">Ranking ≥ 3 estrelas</SelectItem>
                <SelectItem value="4">Ranking ≥ 4 estrelas</SelectItem>
                <SelectItem value="5">Ranking ≥ 5 estrelas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-slate-200 shadow-2xs">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-xs font-semibold text-slate-600">Nome</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Contato</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">
                  Vaga Vinculada
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">
                  <button
                    className="flex items-center gap-1 hover:text-indigo-600"
                    onClick={() => setSortByRank(sortByRank === 'desc' ? 'asc' : 'desc')}
                  >
                    Ranking
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Status</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Custo Total</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 text-right">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCandidates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500 text-sm">
                    Nenhum candidato encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredCandidates.map((cand) => {
                  const totalCost =
                    (cand.custo_consultas || 0) +
                    (cand.custo_exames || 0) +
                    (cand.custo_testes || 0) +
                    (cand.custo_extras || 0)

                  return (
                    <TableRow key={cand.id} className="hover:bg-slate-50/80">
                      <TableCell className="font-bold text-slate-900 text-sm">
                        {cand.nome}
                      </TableCell>

                      <TableCell className="text-xs text-slate-600">
                        <div>{cand.email || '-'}</div>
                        <div className="text-slate-400">{cand.telefone}</div>
                      </TableCell>

                      <TableCell className="text-xs text-slate-700">
                        <div className="flex items-center space-x-1">
                          <Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <div className="min-w-0">
                            <span className="font-medium truncate max-w-[180px] block">
                              {cand.expand?.vacancy_id?.expand?.cargo?.nome ||
                                'Vaga não encontrada'}
                            </span>
                            {cand.expand?.vacancy_id?.expand?.tipo_contrato?.nome && (
                              <span className="text-[10px] text-slate-400">
                                {cand.expand?.vacancy_id?.expand?.tipo_contrato?.nome}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        {cand.rank ? (
                          <StarRating value={cand.rank} readOnly size={14} />
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getCandidateStatusBadgeClass(cand.status_candidato)}
                        >
                          {cand.status_candidato}
                        </Badge>
                      </TableCell>

                      <TableCell className="font-semibold text-slate-900 text-xs">
                        {formatCurrency(totalCost)}
                      </TableCell>

                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal(cand)}
                          className="h-8 w-8 text-slate-600 hover:text-amber-600"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Candidate */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCandidate ? 'Editar Candidato' : 'Novo Candidato'}</DialogTitle>
            <DialogDescription>
              {editingCandidate
                ? 'Atualize as informações e custos'
                : 'Cadastre um novo candidato no sistema'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="nome" className="text-xs font-bold text-slate-700">
                Nome Completo <span className="text-rose-500">*</span>
              </Label>
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tel" className="text-xs font-semibold text-slate-700">
                  Telefone
                </Label>
                <Input id="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                Vaga Vinculada <span className="text-rose-500">*</span>
              </Label>
              <Select value={vacancyId} onValueChange={setVacancyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a vaga" />
                </SelectTrigger>
                <SelectContent>
                  {vacancies.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.expand?.cargo?.nome || v.cargo} ({v.expand?.cliente?.nome || v.cliente})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Status do Candidato</Label>
              <Select
                value={statusCandidato}
                onValueChange={(v) => setStatusCandidato(v as CandidateStatus)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Em análise do gestor">Em análise do gestor</SelectItem>
                  <SelectItem value="Pré-Aprovado">Pré-Aprovado</SelectItem>
                  <SelectItem value="Integrado">Integrado</SelectItem>
                  <SelectItem value="Desistiu">Desistiu</SelectItem>
                  <SelectItem value="Não aprovado">Não aprovado</SelectItem>
                  <SelectItem value="Rejeitado">Rejeitado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Ranking (1-5 estrelas)</Label>
              <StarRating value={rank} onChange={setRank} size={28} />
              {rankError && <p className="text-xs text-rose-500 mt-1">{rankError}</p>}
            </div>

            <div className="pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-700 block mb-2">Custos (R$)</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <Label htmlFor="c1" className="text-[10px] text-slate-500">
                    Consultas
                  </Label>
                  <CurrencyInput id="c1" value={custoConsultas} onChange={setCustoConsultas} />
                </div>
                <div>
                  <Label htmlFor="c2" className="text-[10px] text-slate-500">
                    Exames
                  </Label>
                  <CurrencyInput id="c2" value={custoExames} onChange={setCustoExames} />
                </div>
                <div>
                  <Label htmlFor="c3" className="text-[10px] text-slate-500">
                    Testes
                  </Label>
                  <CurrencyInput id="c3" value={custoTestes} onChange={setCustoTestes} />
                </div>
                <div>
                  <Label htmlFor="c4" className="text-[10px] text-slate-500">
                    Extras
                  </Label>
                  <CurrencyInput id="c4" value={custoExtras} onChange={setCustoExtras} />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                {saving ? 'Salvando...' : 'Salvar Candidato'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
