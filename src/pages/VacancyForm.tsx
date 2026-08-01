import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createVacancy, getVacancy, updateVacancy } from '@/services/vacancies'
import { getUsers } from '@/services/users'
import { getClientes } from '@/services/clientes'
import { getCargos } from '@/services/cargos'
import { getCidades } from '@/services/cidades'
import { getTiposVaga } from '@/services/tipos_vaga'
import { getTiposContrato } from '@/services/tipos_contrato'
import { getCandidates } from '@/services/candidates'
import {
  UserRecord,
  ClienteRecord,
  CargoRecord,
  CidadeRecord,
  TipoVagaRecord,
  TipoContratoRecord,
  CandidateRecord,
  VacancyStatus,
  VacancyPriority,
} from '@/types'
import { useAuth } from '@/hooks/use-auth'
import {
  VACANCY_STATUS_OPTIONS,
  VACANCY_STATUS_LABELS,
  toDateInputValue,
  getMissingRequiredFields,
} from '@/lib/status-utils'
import { Combobox } from '@/components/Combobox'
import { CurrencyInput } from '@/components/CurrencyInput'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { ArrowLeft, Save, Briefcase } from 'lucide-react'

export default function VacancyForm() {
  const { id } = useParams<{ id: string }>()
  const isEditing = !!id
  const navigate = useNavigate()
  const { user, canEditVacancy } = useAuth()

  const [usersList, setUsersList] = useState<UserRecord[]>([])
  const [clientesList, setClientesList] = useState<ClienteRecord[]>([])
  const [cargosList, setCargosList] = useState<CargoRecord[]>([])
  const [cidadesList, setCidadesList] = useState<CidadeRecord[]>([])
  const [tiposVagaList, setTiposVagaList] = useState<TipoVagaRecord[]>([])
  const [tiposContratoList, setTiposContratoList] = useState<TipoContratoRecord[]>([])
  const [tipoContrato, setTipoContrato] = useState('')
  const [candidatesList, setCandidatesList] = useState<CandidateRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(isEditing)

  const [cliente, setCliente] = useState('')
  const [cargo, setCargo] = useState('')
  const [cidade, setCidade] = useState('')
  const [quantidadeVagas, setQuantidadeVagas] = useState(1)
  const [tipoVaga, setTipoVaga] = useState('')
  const [dataAbertura, setDataAbertura] = useState(new Date().toISOString().split('T')[0])
  const [dataFechamento, setDataFechamento] = useState('')
  const [dataCancelamento, setDataCancelamento] = useState('')
  const [prazoDesejado, setPrazoDesejado] = useState('')
  const [responsavelRh, setResponsavelRh] = useState('')
  const [responsavelOperacional, setResponsavelOperacional] = useState('')
  const [statusVaga, setStatusVaga] = useState<VacancyStatus>('Aberta')
  const [prioridade, setPrioridade] = useState<VacancyPriority>('Média')
  const [salarioFaixa, setSalarioFaixa] = useState('')
  const [despesasVaga, setDespesasVaga] = useState(0)
  const [especificacoes, setEspecificacoes] = useState('')
  const [observacoesInternas, setObservacoesInternas] = useState('')
  const [ordemExecucao, setOrdemExecucao] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const missingRequiredFields = useMemo(() => {
    if (!isEditing) return []
    return getMissingRequiredFields({
      quantidade_vagas: quantidadeVagas,
      data_abertura: dataAbertura,
      prazo_desejado: prazoDesejado,
      responsavel_rh: responsavelRh,
      responsavel_operacional: responsavelOperacional,
      prioridade,
      salario_faixa: salarioFaixa,
      cliente,
      cargo,
      cidade,
      tipo_vaga: tipoVaga,
      tipo_contrato: tipoContrato,
    })
  }, [
    isEditing,
    quantidadeVagas,
    dataAbertura,
    prazoDesejado,
    responsavelRh,
    responsavelOperacional,
    prioridade,
    salarioFaixa,
    cliente,
    cargo,
    cidade,
    tipoVaga,
    tipoContrato,
  ])

  const isStatusDisabled = isEditing && (missingRequiredFields.length > 0 || !ordemExecucao.trim())

  const integradoCount = useMemo(
    () => candidatesList.filter((c) => c.status_candidato === 'Integrado').length,
    [candidatesList],
  )
  const canCloseVacancy = quantidadeVagas > 0 && integradoCount >= quantidadeVagas

  const clienteOptions = useMemo(
    () => clientesList.map((c) => ({ value: c.id, label: c.nome })),
    [clientesList],
  )
  const cargoOptions = useMemo(
    () => cargosList.map((c) => ({ value: c.id, label: c.nome })),
    [cargosList],
  )
  const cidadeOptions = useMemo(
    () => cidadesList.map((c) => ({ value: c.id, label: c.nome })),
    [cidadesList],
  )
  const tipoVagaOptions = useMemo(
    () => tiposVagaList.map((t) => ({ value: t.id, label: t.nome })),
    [tiposVagaList],
  )
  const tipoContratoOptions = useMemo(
    () => tiposContratoList.map((t) => ({ value: t.id, label: t.nome })),
    [tiposContratoList],
  )

  useEffect(() => {
    const loadInitial = async () => {
      try {
        const [uList, clList, cgList, cdList, tvList, tcList] = await Promise.all([
          getUsers(),
          getClientes(),
          getCargos(),
          getCidades(),
          getTiposVaga(),
          getTiposContrato(),
        ])
        setUsersList(uList)
        setClientesList(clList)
        setCargosList(cgList)
        setCidadesList(cdList)
        setTiposVagaList(tvList)
        setTiposContratoList(tcList)

        if (!responsavelRh && user) setResponsavelRh(user.id)

        if (isEditing) {
          const vaga = await getVacancy(id)
          setCliente(vaga.cliente || '')
          setCargo(vaga.cargo || '')
          setCidade(vaga.cidade || '')
          setQuantidadeVagas(vaga.quantidade_vagas || 1)
          setTipoVaga(vaga.tipo_vaga || '')
          setTipoContrato(vaga.tipo_contrato || '')
          setDataAbertura(toDateInputValue(vaga.data_abertura))
          setDataFechamento(toDateInputValue(vaga.data_fechamento))
          setDataCancelamento(toDateInputValue(vaga.data_cancelamento))
          setPrazoDesejado(toDateInputValue(vaga.prazo_desejado))
          setResponsavelRh(vaga.responsavel_rh || '')
          setResponsavelOperacional(vaga.responsavel_operacional || '')
          setStatusVaga(vaga.status_vaga)
          setPrioridade(vaga.prioridade)
          setSalarioFaixa(vaga.salario_faixa || '')
          setDespesasVaga(vaga.despesas_vaga || 0)
          setOrdemExecucao(vaga.ordem_execucao || '')
          setEspecificacoes(vaga.especificacoes || '')
          setObservacoesInternas(vaga.observacoes_internas || '')

          const cands = await getCandidates(id)
          setCandidatesList(cands)
        }
      } catch {
        toast.error('Erro ao carregar dados do formulário')
      } finally {
        setFetching(false)
      }
    }
    loadInitial()
  }, [id, isEditing])

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!cliente) errs.cliente = 'Cliente é obrigatório'
    if (!cargo) errs.cargo = 'Cargo é obrigatório'
    if (!statusVaga) errs.statusVaga = 'Status é obrigatório'
    if (!responsavelRh) errs.responsavelRh = 'Responsável RH é obrigatório'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) {
      toast.error('Preencha todos os campos obrigatórios.')
      return
    }
    setLoading(true)

    if (statusVaga === 'Concluída' && !canCloseVacancy) {
      toast.error(
        'O número de candidatos integrados deve ser igual à quantidade de vagas para fechar a vaga.',
      )
      setLoading(false)
      return
    }

    const payload = {
      cliente,
      cargo,
      cidade: cidade || null,
      quantidade_vagas: Number(quantidadeVagas),
      tipo_vaga: tipoVaga || null,
      tipo_contrato: tipoContrato || null,
      data_abertura: dataAbertura ? new Date(dataAbertura).toISOString() : undefined,
      data_fechamento: dataFechamento ? new Date(dataFechamento).toISOString() : undefined,
      data_cancelamento: dataCancelamento ? new Date(dataCancelamento).toISOString() : undefined,
      prazo_desejado: prazoDesejado ? new Date(prazoDesejado).toISOString() : undefined,
      responsavel_rh: responsavelRh,
      responsavel_operacional: responsavelOperacional,
      status_vaga: statusVaga,
      prioridade,
      salario_faixa: salarioFaixa,
      despesas_vaga: Number(despesasVaga),
      ordem_execucao: ordemExecucao,
      especificacoes,
      observacoes_internas: observacoesInternas,
    }
    try {
      if (isEditing) {
        await updateVacancy(id, payload)
        toast.success('Vaga atualizada com sucesso!')
      } else {
        await createVacancy(payload)
        toast.success('Vaga criada com sucesso!')
      }
      navigate('/vagas')
    } catch {
      toast.error('Erro ao salvar vaga')
    } finally {
      setLoading(false)
    }
  }

  if (!canEditVacancy) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3 text-center">
        <p className="text-sm text-slate-600">
          Você não tem permissão para {isEditing ? 'editar' : 'criar'} vagas.
        </p>
        <Button variant="outline" onClick={() => navigate('/vagas')}>
          Voltar para Vagas
        </Button>
      </div>
    )
  }

  if (fetching) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Button variant="ghost" onClick={() => navigate('/vagas')} className="text-slate-600">
        <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para Vagas
      </Button>

      <Card className="border-slate-200 shadow-md">
        <CardHeader className="bg-slate-50/80 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-slate-900">
                {isEditing ? 'Editar Vaga' : 'Nova Vaga de Emprego'}
              </CardTitle>
              <p className="text-xs text-slate-500">
                Preencha os detalhes e especificações do perfil solicitado
              </p>
            </div>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Cliente <span className="text-rose-500">*</span>
                </Label>
                <Combobox
                  options={clienteOptions}
                  value={cliente}
                  onChange={setCliente}
                  placeholder="Selecionar cliente..."
                  searchPlaceholder="Buscar cliente..."
                  emptyText="Nenhum cliente cadastrado."
                  className={errors.cliente ? 'border-rose-500' : ''}
                />
                {errors.cliente && <p className="text-[11px] text-rose-500">{errors.cliente}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Cargo <span className="text-rose-500">*</span>
                </Label>
                <Combobox
                  options={cargoOptions}
                  value={cargo}
                  onChange={setCargo}
                  placeholder="Selecionar cargo..."
                  searchPlaceholder="Buscar cargo..."
                  emptyText="Nenhum cargo cadastrado."
                  className={errors.cargo ? 'border-rose-500' : ''}
                />
                {errors.cargo && <p className="text-[11px] text-rose-500">{errors.cargo}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Cidade / Estado</Label>
                <Combobox
                  options={cidadeOptions}
                  value={cidade}
                  onChange={setCidade}
                  placeholder="Selecionar cidade..."
                  searchPlaceholder="Buscar cidade..."
                  emptyText="Nenhuma cidade cadastrada."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="quantidade" className="text-xs font-semibold text-slate-700">
                  Quantidade de Vagas
                </Label>
                <Input
                  id="quantidade"
                  type="number"
                  min={1}
                  value={quantidadeVagas}
                  onChange={(e) => setQuantidadeVagas(Number(e.target.value))}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Tipo de Vaga</Label>
                <Combobox
                  options={tipoVagaOptions}
                  value={tipoVaga}
                  onChange={setTipoVaga}
                  placeholder="Selecionar tipo..."
                  searchPlaceholder="Buscar tipo..."
                  emptyText="Nenhum tipo cadastrado."
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Tipo de Contrato</Label>
                <Combobox
                  options={tipoContratoOptions}
                  value={tipoContrato}
                  onChange={setTipoContrato}
                  placeholder="Selecionar tipo de contrato..."
                  searchPlaceholder="Buscar tipo de contrato..."
                  emptyText="Nenhum tipo de contrato cadastrado."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="salario" className="text-xs font-semibold text-slate-700">
                  Faixa Salarial / Remuneração
                </Label>
                <Input
                  id="salario"
                  placeholder="Ex: R$ 8.000,00 - R$ 10.000,00 ou A Combinar"
                  value={salarioFaixa}
                  onChange={(e) => setSalarioFaixa(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="despesasVaga" className="text-xs font-semibold text-slate-700">
                  Despesas com a Vaga
                </Label>
                <CurrencyInput
                  id="despesasVaga"
                  value={despesasVaga}
                  onChange={setDespesasVaga}
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ordemExecucao" className="text-xs font-bold text-slate-700">
                  O.E — Ordem de Execução
                </Label>
                <Input
                  id="ordemExecucao"
                  placeholder="Informe a ordem de execução"
                  value={ordemExecucao}
                  onChange={(e) => setOrdemExecucao(e.target.value)}
                />
                {!ordemExecucao.trim() && isEditing && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    O preenchimento da O.E é necessário para habilitar a alteração de status da
                    vaga.
                  </p>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Status da Vaga <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={statusVaga}
                  onValueChange={(v) => setStatusVaga(v as VacancyStatus)}
                  disabled={isStatusDisabled}
                >
                  <SelectTrigger
                    className={isStatusDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                  >
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    {VACANCY_STATUS_OPTIONS.map((st) => (
                      <SelectItem
                        key={st}
                        value={st}
                        disabled={st === 'Concluída' && !canCloseVacancy}
                      >
                        {VACANCY_STATUS_LABELS[st]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!canCloseVacancy && quantidadeVagas > 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    Para fechar a vaga, o número de candidatos integrados ({integradoCount}) deve
                    ser igual à quantidade de vagas ({quantidadeVagas}).
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Prioridade <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={prioridade}
                  onValueChange={(v) => setPrioridade(v as VacancyPriority)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Alta">Alta</SelectItem>
                    <SelectItem value="Média">Média</SelectItem>
                    <SelectItem value="Baixa">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Responsável RH <span className="text-rose-500">*</span>
                </Label>
                <Select value={responsavelRh} onValueChange={setResponsavelRh}>
                  <SelectTrigger className={errors.responsavelRh ? 'border-rose-500' : ''}>
                    <SelectValue placeholder="Selecione o usuário RH" />
                  </SelectTrigger>
                  <SelectContent>
                    {usersList.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.responsavelRh && (
                  <p className="text-[11px] text-rose-500">{errors.responsavelRh}</p>
                )}
              </div>

              <div className="space-y-1.5 sm:col-span-3">
                <Label htmlFor="operacional" className="text-xs font-semibold text-slate-700">
                  Responsável Operacional / Solicitante
                </Label>
                <Input
                  id="operacional"
                  placeholder="Nome do gestor do cliente (ex: Carlos Silva - Gerente de Produção)"
                  value={responsavelOperacional}
                  onChange={(e) => setResponsavelOperacional(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="dataAbertura" className="text-xs font-semibold text-slate-700">
                  Data de Abertura
                </Label>
                <Input
                  id="dataAbertura"
                  type="date"
                  value={dataAbertura}
                  onChange={(e) => setDataAbertura(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prazoDesejado" className="text-xs font-semibold text-slate-700">
                  Prazo Desejado
                </Label>
                <Input
                  id="prazoDesejado"
                  type="date"
                  value={prazoDesejado}
                  onChange={(e) => setPrazoDesejado(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dataFechamento" className="text-xs font-semibold text-slate-700">
                  Data de Fechamento
                </Label>
                <Input
                  id="dataFechamento"
                  type="date"
                  value={dataFechamento}
                  onChange={(e) => setDataFechamento(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dataCancelamento" className="text-xs font-semibold text-slate-700">
                  Data de Cancelamento
                </Label>
                <Input
                  id="dataCancelamento"
                  type="date"
                  value={dataCancelamento}
                  onChange={(e) => setDataCancelamento(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="especificacoes" className="text-xs font-semibold text-slate-700">
                  Especificações e Requisitos da Vaga
                </Label>
                <Textarea
                  id="especificacoes"
                  rows={3}
                  placeholder="Descreva as competências, formação exigida e detalhes da função..."
                  value={especificacoes}
                  onChange={(e) => setEspecificacoes(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="observacoes" className="text-xs font-semibold text-slate-700">
                  Observações Internas (RH)
                </Label>
                <Textarea
                  id="observacoes"
                  rows={2}
                  placeholder="Anotações internas do processo seletivo..."
                  value={observacoesInternas}
                  onChange={(e) => setObservacoesInternas(e.target.value)}
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="bg-slate-50 border-t border-slate-200 p-4 flex justify-between">
            <Button type="button" variant="outline" onClick={() => navigate('/vagas')}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm"
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Salvando...' : isEditing ? 'Atualizar Vaga' : 'Salvar Vaga'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
