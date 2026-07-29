import { useState, useEffect, useCallback } from 'react'
import { Mail, Plus, Pencil, Trash2, Search, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StarRating } from '@/components/StarRating'
import { CurrencyInput } from '@/components/CurrencyInput'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import {
  getCandidates,
  createCandidate,
  updateCandidate,
  deleteCandidate,
  sendComplementDataRequest,
  sendDisqualificationNotice,
} from '@/services/candidates'
import { getEmailLogsForCandidate, hasEmailBeenSent } from '@/services/candidate_email_logs'
import { getVacancies } from '@/services/vacancies'
import { CandidateRecord, CandidateStatus, VacancyRecord, CandidateEmailLogRecord } from '@/types'
import { toast } from '@/components/ui/use-toast'
import { getCandidateStatusBadgeClass, formatDateBR } from '@/lib/status-utils'
import { getErrorMessage, extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'

const COMPLEMENT_STATUSES: CandidateStatus[] = [
  'Análise do RH',
  'Análise do gestor',
  'Documentação e exame',
]

const DISQUALIFICATION_STATUSES: CandidateStatus[] = ['Desclassificado', 'Em banco']

const CANDIDATE_STATUSES: CandidateStatus[] = [
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
  const { user } = useAuth()
  const [candidates, setCandidates] = useState<CandidateRecord[]>([])
  const [vacancies, setVacancies] = useState<VacancyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCandidate, setEditingCandidate] = useState<CandidateRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [sendingDisqualEmail, setSendingDisqualEmail] = useState(false)
  const [emailLogs, setEmailLogs] = useState<CandidateEmailLogRecord[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterVacancyId, setFilterVacancyId] = useState<string>('all')

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cpf, setCpf] = useState('')
  const [cidade, setCidade] = useState('')
  const [bairro, setBairro] = useState('')
  const [vacancyId, setVacancyId] = useState('')
  const [status, setStatus] = useState<CandidateStatus>('Análise do RH')
  const [rank, setRank] = useState(0)
  const [rankError, setRankError] = useState('')
  const [custoConsultas, setCustoConsultas] = useState(0)
  const [custoExames, setCustoExames] = useState(0)
  const [custoTestes, setCustoTestes] = useState(0)
  const [custoExtras, setCustoExtras] = useState(0)
  const [rg, setRg] = useState('')
  const [tamanhoFardamento, setTamanhoFardamento] = useState('')
  const [tamanhoSapato, setTamanhoSapato] = useState('')
  const [valeTransporteQtd, setValeTransporteQtd] = useState<number>(0)
  const [nomePai, setNomePai] = useState('')
  const [nomeMae, setNomeMae] = useState('')
  const [telefoneEmergencia, setTelefoneEmergencia] = useState('')
  const [observacao, setObservacao] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const isAdminOrSuper = user?.profile === 'admin' || user?.profile === 'superadmin'

  const loadData = useCallback(async () => {
    try {
      const [cands, vacs] = await Promise.all([getCandidates(), getVacancies()])
      setCandidates(cands)
      setVacancies(vacs)
    } catch (err) {
      toast({ title: 'Erro', description: getErrorMessage(err), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])
  useRealtime('candidates', () => {
    loadData()
  })

  const resetForm = () => {
    setNome('')
    setEmail('')
    setTelefone('')
    setCpf('')
    setCidade('')
    setBairro('')
    setVacancyId('')
    setStatus('Análise do RH')
    setRank(0)
    setRankError('')
    setCustoConsultas(0)
    setCustoExames(0)
    setCustoTestes(0)
    setCustoExtras(0)
    setRg('')
    setTamanhoFardamento('')
    setTamanhoSapato('')
    setValeTransporteQtd(0)
    setNomePai('')
    setNomeMae('')
    setTelefoneEmergencia('')
    setObservacao('')
    setFieldErrors({})
    setEmailLogs([])
    setEditingCandidate(null)
  }

  const handleOpenModal = () => {
    resetForm()
    setModalOpen(true)
  }

  const handleEdit = (candidate: CandidateRecord) => {
    resetForm()
    setEditingCandidate(candidate)
    setNome(candidate.nome || '')
    setEmail(candidate.email || '')
    setTelefone(candidate.telefone || '')
    setCpf(candidate.cpf || '')
    setCidade(candidate.cidade || '')
    setBairro(candidate.bairro || '')
    setVacancyId(candidate.vacancy_id || '')
    setStatus(candidate.status_candidato || 'Análise do RH')
    setRank(candidate.rank || 0)
    setCustoConsultas(candidate.custo_consultas || 0)
    setCustoExames(candidate.custo_exames || 0)
    setCustoTestes(candidate.custo_testes || 0)
    setCustoExtras(candidate.custo_extras || 0)
    setRg(candidate.rg || '')
    setTamanhoFardamento(candidate.tamanho_fardamento || '')
    setTamanhoSapato(candidate.tamanho_sapato || '')
    setValeTransporteQtd(candidate.vale_transporte_qtd || 0)
    setNomePai(candidate.nome_pai || '')
    setNomeMae(candidate.nome_mae || '')
    setTelefoneEmergencia(candidate.telefone_emergencia || '')
    setObservacao(candidate.observacao || '')
    setEmailLogs([])
    getEmailLogsForCandidate(candidate.id)
      .then(setEmailLogs)
      .catch(() => {})
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setRankError('')
    setFieldErrors({})

    let hasError = false

    if (rank < 1 || rank > 5) {
      setRankError('Selecione uma classificação de 1 a 5 estrelas')
      hasError = true
    }
    if (!nome.trim()) {
      setFieldErrors((prev) => ({ ...prev, nome: 'Nome é obrigatório' }))
      hasError = true
    }
    if (!vacancyId) {
      setFieldErrors((prev) => ({ ...prev, vacancy_id: 'Selecione uma vaga' }))
      hasError = true
    }
    if (hasError) return

    setSaving(true)
    try {
      const data: Partial<CandidateRecord> = {
        nome: nome.trim(),
        email: email.trim() || undefined,
        telefone: telefone.trim() || undefined,
        cpf: cpf.trim() || undefined,
        cidade: cidade.trim() || undefined,
        bairro: bairro.trim() || undefined,
        vacancy_id: vacancyId,
        status_candidato: status,
        rank,
        custo_consultas: custoConsultas,
        custo_exames: custoExames,
        custo_testes: custoTestes,
        custo_extras: custoExtras,
        rg: rg.trim() || undefined,
        tamanho_fardamento: tamanhoFardamento || undefined,
        tamanho_sapato: tamanhoSapato.trim() || undefined,
        vale_transporte_qtd: valeTransporteQtd || undefined,
        nome_pai: nomePai.trim() || undefined,
        nome_mae: nomeMae.trim() || undefined,
        telefone_emergencia: telefoneEmergencia.trim() || undefined,
        observacao: isAdminOrSuper ? observacao.trim() || undefined : undefined,
      }

      if (editingCandidate) {
        await updateCandidate(editingCandidate.id, data)
        toast({ title: 'Sucesso', description: 'Candidato atualizado com sucesso!' })
      } else {
        await createCandidate(data)
        toast({ title: 'Sucesso', description: 'Candidato criado com sucesso!' })
      }
      setModalOpen(false)
      resetForm()
    } catch (err) {
      setFieldErrors(extractFieldErrors(err))
      toast({ title: 'Erro', description: getErrorMessage(err), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este candidato?')) return
    try {
      await deleteCandidate(id)
      toast({ title: 'Sucesso', description: 'Candidato excluído com sucesso!' })
    } catch (err) {
      toast({ title: 'Erro', description: getErrorMessage(err), variant: 'destructive' })
    }
  }

  const handleSendEmail = async () => {
    if (!editingCandidate) return
    setSendingEmail(true)
    try {
      await sendComplementDataRequest(editingCandidate.id)
      toast({ title: 'Sucesso', description: 'E-mail enviado com sucesso!' })
      const logs = await getEmailLogsForCandidate(editingCandidate.id)
      setEmailLogs(logs)
    } catch (err) {
      toast({ title: 'Erro', description: getErrorMessage(err), variant: 'destructive' })
    } finally {
      setSendingEmail(false)
    }
  }

  const handleSendDisqualification = async () => {
    if (!editingCandidate) return
    setSendingDisqualEmail(true)
    try {
      await sendDisqualificationNotice(editingCandidate.id)
      toast({ title: 'Sucesso', description: 'E-mail enviado com sucesso!' })
      const logs = await getEmailLogsForCandidate(editingCandidate.id)
      setEmailLogs(logs)
    } catch (err) {
      toast({ title: 'Erro', description: getErrorMessage(err), variant: 'destructive' })
    } finally {
      setSendingDisqualEmail(false)
    }
  }

  const filteredCandidates = candidates.filter((c) => {
    const matchesSearch =
      c.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesVacancy = filterVacancyId === 'all' || c.vacancy_id === filterVacancyId
    return matchesSearch && matchesVacancy
  })

  const getVacancyLabel = (id: string) => {
    const v = vacancies.find((v) => v.id === id)
    if (!v) return '—'
    const cliente = v.expand?.cliente?.nome || ''
    const cargo = v.expand?.cargo?.nome || ''
    return `${cliente} — ${cargo}`.replace(/^—\s*/, '').trim() || '—'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <p className="text-slate-500">Carregando candidatos...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Candidatos</h1>
          <p className="text-sm text-slate-500">Gerencie os candidatos das vagas</p>
        </div>
        <Button onClick={handleOpenModal} className="bg-indigo-600 hover:bg-indigo-500 text-white">
          <Plus className="h-4 w-4 mr-2" />
          Novo Candidato
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por nome ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterVacancyId} onValueChange={setFilterVacancyId}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Filtrar por vaga" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as vagas</SelectItem>
            {vacancies.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {getVacancyLabel(v.id)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left font-semibold text-slate-600 px-4 py-3">Nome</th>
                <th className="text-left font-semibold text-slate-600 px-4 py-3 hidden md:table-cell">
                  Vaga
                </th>
                <th className="text-left font-semibold text-slate-600 px-4 py-3 hidden lg:table-cell">
                  Contato
                </th>
                <th className="text-left font-semibold text-slate-600 px-4 py-3">Status</th>
                <th className="text-center font-semibold text-slate-600 px-4 py-3">Rank</th>
                <th className="text-right font-semibold text-slate-600 px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCandidates.map((candidate) => (
                <tr key={candidate.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{candidate.nome}</div>
                    {candidate.cpf && (
                      <div className="text-xs text-slate-400">CPF: {candidate.cpf}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-slate-600">
                    {getVacancyLabel(candidate.vacancy_id)}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-slate-600">
                    <div>{candidate.email || '—'}</div>
                    <div className="text-xs text-slate-400">{candidate.telefone || ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={getCandidateStatusBadgeClass(candidate.status_candidato)}>
                      {candidate.status_candidato}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StarRating value={candidate.rank || 0} onChange={() => {}} size={16} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(candidate)}
                        className="h-8 w-8 text-slate-500 hover:text-indigo-600"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(candidate.id)}
                        className="h-8 w-8 text-slate-500 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCandidates.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Nenhum candidato encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCandidate ? 'Editar Candidato' : 'Novo Candidato'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label htmlFor="nome" className="text-xs font-bold text-slate-700">
                  Nome <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome completo"
                />
                {fieldErrors.nome && (
                  <p className="text-xs text-rose-500 mt-0.5">{fieldErrors.nome}</p>
                )}
              </div>
              <div>
                <Label htmlFor="email" className="text-xs font-bold text-slate-700">
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@email.com"
                />
              </div>
              <div>
                <Label htmlFor="telefone" className="text-xs font-bold text-slate-700">
                  Telefone
                </Label>
                <Input
                  id="telefone"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <Label htmlFor="cpf" className="text-xs font-bold text-slate-700">
                  CPF
                </Label>
                <Input
                  id="cpf"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <Label htmlFor="cidade" className="text-xs font-bold text-slate-700">
                  Cidade
                </Label>
                <Input id="cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="bairro" className="text-xs font-bold text-slate-700">
                  Bairro
                </Label>
                <Input id="bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs font-bold text-slate-700">
                  Vaga <span className="text-rose-500">*</span>
                </Label>
                <Select value={vacancyId} onValueChange={setVacancyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma vaga" />
                  </SelectTrigger>
                  <SelectContent>
                    {vacancies.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {getVacancyLabel(v.id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.vacancy_id && (
                  <p className="text-xs text-rose-500 mt-0.5">{fieldErrors.vacancy_id}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Status do Candidato</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as CandidateStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {CANDIDATE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Ranking (1-5 estrelas)</Label>
              <StarRating value={rank} onChange={setRank} size={28} />
              {rankError && <p className="text-xs text-rose-500 mt-1">{rankError}</p>}
            </div>

            {isAdminOrSuper && (
              <div className="space-y-1.5">
                <Label htmlFor="observacoes" className="text-xs font-bold text-slate-700">
                  Observações
                </Label>
                <Textarea
                  id="observacao"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Adicione observações sobre o candidato..."
                  rows={3}
                />
              </div>
            )}

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

            <div className="pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-700 block mb-2">
                Dados Complementares
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <Label htmlFor="dRg" className="text-[10px] text-slate-500">
                    RG
                  </Label>
                  <Input id="dRg" value={rg} onChange={(e) => setRg(e.target.value)} />
                </div>
                <div>
                  <Label className="text-[10px] text-slate-500">Tamanho Fardamento</Label>
                  <Select value={tamanhoFardamento} onValueChange={setTamanhoFardamento}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PP">PP</SelectItem>
                      <SelectItem value="P">P</SelectItem>
                      <SelectItem value="M">M</SelectItem>
                      <SelectItem value="G">G</SelectItem>
                      <SelectItem value="GG">GG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="dSapato" className="text-[10px] text-slate-500">
                    Tamanho Sapato
                  </Label>
                  <Input
                    id="dSapato"
                    value={tamanhoSapato}
                    onChange={(e) => setTamanhoSapato(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="dVt" className="text-[10px] text-slate-500">
                    Vale-transporte (qtd/dia)
                  </Label>
                  <Input
                    id="dVt"
                    type="number"
                    min={0}
                    value={valeTransporteQtd}
                    onChange={(e) => setValeTransporteQtd(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="dPai" className="text-[10px] text-slate-500">
                    Nome do Pai
                  </Label>
                  <Input id="dPai" value={nomePai} onChange={(e) => setNomePai(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="dMae" className="text-[10px] text-slate-500">
                    Nome da Mãe
                  </Label>
                  <Input id="dMae" value={nomeMae} onChange={(e) => setNomeMae(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="dEmergencia" className="text-[10px] text-slate-500">
                    Telefone para Emergência
                  </Label>
                  <Input
                    id="dEmergencia"
                    value={telefoneEmergencia}
                    onChange={(e) => setTelefoneEmergencia(e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
            </div>

            {editingCandidate && isAdminOrSuper && (
              <div className="pt-2 border-t border-slate-100 space-y-2">
                {COMPLEMENT_STATUSES.includes(editingCandidate.status_candidato) && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendEmail}
                    disabled={sendingEmail || !editingCandidate.email}
                    className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                    title={!editingCandidate.email ? 'Candidato não possui e-mail cadastrado' : ''}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {sendingEmail ? 'Enviando...' : 'Solicitar dados complementares'}
                    {hasEmailBeenSent(emailLogs, 'complement_data') && (
                      <Check className="h-4 w-4 ml-2 text-emerald-600" />
                    )}
                  </Button>
                )}
                {DISQUALIFICATION_STATUSES.includes(editingCandidate.status_candidato) && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendDisqualification}
                    disabled={sendingDisqualEmail || !editingCandidate.email}
                    className="w-full border-amber-200 text-amber-700 hover:bg-amber-50"
                    title={!editingCandidate.email ? 'Candidato não possui e-mail cadastrado' : ''}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {sendingDisqualEmail ? 'Enviando...' : 'Aviso de Desclassificação/Banco'}
                    {hasEmailBeenSent(emailLogs, 'disqualification') && (
                      <Check className="h-4 w-4 ml-2 text-emerald-600" />
                    )}
                  </Button>
                )}
              </div>
            )}

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
