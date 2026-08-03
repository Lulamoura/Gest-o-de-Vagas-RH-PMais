import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { CheckCircle2, User, Briefcase, AlertCircle, RefreshCw } from 'lucide-react'

interface PublicCandidateData {
  nome: string
  email: string
  vacancy_title: string
  rg: string
  tamanho_fardamento: string
  tamanho_sapato: string
  vale_transporte_qtd: number
  nome_pai: string
  nome_mae: string
  telefone_emergencia: string
  data_nascimento: string
  valor_unitario_transporte: number
}

export default function CandidatePublicForm() {
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [data, setData] = useState<PublicCandidateData | null>(null)

  const [rg, setRg] = useState('')
  const [tamanhoFardamento, setTamanhoFardamento] = useState('')
  const [tamanhoSapato, setTamanhoSapato] = useState('')
  const [valeTransporteQtd, setValeTransporteQtd] = useState(0)
  const [nomePai, setNomePai] = useState('')
  const [nomeMae, setNomeMae] = useState('')
  const [telefoneEmergencia, setTelefoneEmergencia] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [valorUnitarioTransporte, setValorUnitarioTransporte] = useState(0)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const fetchData = () => {
    if (!id) {
      setError('Link inválido. Verifique o endereço ou entre em contato.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    pb.send(`/backend/v1/candidate-public-data/${id}`, { method: 'GET' })
      .then((res: PublicCandidateData) => {
        setData(res)
        setRg(res.rg || '')
        setTamanhoFardamento(res.tamanho_fardamento || '')
        setTamanhoSapato(res.tamanho_sapato || '')
        setValeTransporteQtd(res.vale_transporte_qtd || 0)
        setNomePai(res.nome_pai || '')
        setNomeMae(res.nome_mae || '')
        setTelefoneEmergencia(res.telefone_emergencia || '')
        setDataNascimento(res.data_nascimento || '')
        setValorUnitarioTransporte(res.valor_unitario_transporte || 0)
      })
      .catch((err) => {
        if (err?.isAbort) {
          setError('O tempo limite foi excedido. Verifique sua conexão e tente novamente.')
        } else if (err?.status === 404) {
          setError(
            'Não foi possível carregar seus dados. O link pode estar incorreto ou expirado. Tente novamente.',
          )
        } else {
          setError('Não foi possível carregar seus dados. Tente novamente.')
        }
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchData()
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors: Record<string, string> = {}
    if (!rg.trim()) errors.rg = 'RG é obrigatório.'
    if (!tamanhoFardamento) errors.tamanho_fardamento = 'Tamanho do fardamento é obrigatório.'
    if (!tamanhoSapato.trim()) errors.tamanho_sapato = 'Tamanho do sapato é obrigatório.'
    if (!nomeMae.trim()) errors.nome_mae = 'Nome da mãe é obrigatório.'
    if (!telefoneEmergencia.trim())
      errors.telefone_emergencia = 'Telefone para emergência é obrigatório.'
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    setSubmitting(true)
    setError('')
    try {
      await pb.send(`/backend/v1/candidate-public-data/${id}`, {
        method: 'POST',
        body: JSON.stringify({
          rg,
          tamanho_fardamento: tamanhoFardamento,
          tamanho_sapato: tamanhoSapato,
          vale_transporte_qtd: Number(valeTransporteQtd),
          nome_pai: nomePai,
          nome_mae: nomeMae,
          telefone_emergencia: telefoneEmergencia,
          data_nascimento: dataNascimento,
          valor_unitario_transporte: Number(valorUnitarioTransporte),
        }),
        headers: { 'Content-Type': 'application/json' },
      })
      setSuccess(true)
    } catch (err: any) {
      setError(err?.response?.error || 'Erro ao salvar dados. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full border-slate-200">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-rose-500 mx-auto" />
            <p className="text-slate-700 font-medium">{error}</p>
            <Button onClick={fetchData} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Tente novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full border-slate-200">
          <CardContent className="pt-6 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <h2 className="text-lg font-bold text-slate-900">Dados salvos com sucesso!</h2>
            <p className="text-sm text-slate-500">
              Obrigado pelo preenchimento. Entraremos em contato em breve.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-4 py-8">
      <div className="max-w-lg mx-auto space-y-4">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-slate-900">PMais Terceirização</h1>
          <p className="text-xs text-slate-500">Preenchimento de Dados Complementares</p>
        </div>

        {data && (
          <Card className="bg-white/80 backdrop-blur border-slate-200 shadow-sm">
            <CardHeader className="pb-3 space-y-2">
              <CardTitle className="text-base font-bold text-slate-900">
                Confirme seus dados
              </CardTitle>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <User className="h-3.5 w-3.5" />
                <span className="font-medium">{data.nome}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Briefcase className="h-3.5 w-3.5" />
                <span>{data.vacancy_title}</span>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">
                      RG <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      value={rg}
                      onChange={(e) => setRg(e.target.value)}
                      className="h-9 text-sm"
                    />
                    {fieldErrors.rg && (
                      <p className="text-[10px] text-rose-500">{fieldErrors.rg}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">
                      Tamanho Fardamento <span className="text-rose-500">*</span>
                    </Label>
                    <Select value={tamanhoFardamento} onValueChange={setTamanhoFardamento}>
                      <SelectTrigger className="h-9 text-sm">
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
                    {fieldErrors.tamanho_fardamento && (
                      <p className="text-[10px] text-rose-500">{fieldErrors.tamanho_fardamento}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">
                      Tamanho Sapato <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      value={tamanhoSapato}
                      onChange={(e) => setTamanhoSapato(e.target.value)}
                      className="h-9 text-sm"
                    />
                    {fieldErrors.tamanho_sapato && (
                      <p className="text-[10px] text-rose-500">{fieldErrors.tamanho_sapato}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">
                      Vale-transporte (qtd/dia) <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={valeTransporteQtd}
                      onChange={(e) => setValeTransporteQtd(Number(e.target.value))}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">Nome do Pai</Label>
                    <Input
                      value={nomePai}
                      onChange={(e) => setNomePai(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">
                      Nome da Mãe <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      value={nomeMae}
                      onChange={(e) => setNomeMae(e.target.value)}
                      className="h-9 text-sm"
                    />
                    {fieldErrors.nome_mae && (
                      <p className="text-[10px] text-rose-500">{fieldErrors.nome_mae}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">
                    Telefone para Emergência <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    value={telefoneEmergencia}
                    onChange={(e) => setTelefoneEmergencia(e.target.value)}
                    className="h-9 text-sm"
                    placeholder="(00) 00000-0000"
                  />
                  {fieldErrors.telefone_emergencia && (
                    <p className="text-[10px] text-rose-500">{fieldErrors.telefone_emergencia}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">
                      Data de Nascimento
                    </Label>
                    <Input
                      type="date"
                      value={dataNascimento}
                      onChange={(e) => setDataNascimento(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">
                      Valor Unitário do Transporte
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={valorUnitarioTransporte}
                      onChange={(e) => setValorUnitarioTransporte(Number(e.target.value))}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
                {error && <p className="text-xs text-rose-500 text-center">{error}</p>}
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  {submitting ? 'Salvando...' : 'Salvar Dados'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
