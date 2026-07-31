import { useState, useEffect } from 'react'
import { getCustosConsultas, updateCustosConsultas } from '@/services/custos_consultas'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/CurrencyInput'
import { toast } from 'sonner'
import { Save, DollarSign } from 'lucide-react'

export function CostConsultationsForm() {
  const { isAdmin, isSuperAdmin } = useAuth()
  const canEdit = isAdmin || isSuperAdmin
  const [recordId, setRecordId] = useState<string | null>(null)
  const [consultaJuridica, setConsultaJuridica] = useState(0)
  const [resumoIa, setResumoIa] = useState(0)
  const [capaProcesso, setCapaProcesso] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const record = await getCustosConsultas()
        if (record) {
          setRecordId(record.id)
          setConsultaJuridica(record.consulta_juridica || 0)
          setResumoIa(record.resumo_ia || 0)
          setCapaProcesso(record.capa_processo || 0)
        }
      } catch {
        toast.error('Erro ao carregar custos')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recordId) {
      toast.error('Nenhum registro encontrado para atualizar')
      return
    }
    setSaving(true)
    try {
      await updateCustosConsultas(recordId, {
        consulta_juridica: consultaJuridica,
        resumo_ia: resumoIa,
        capa_processo: capaProcesso,
      })
      toast.success('Custos atualizados com sucesso!')
    } catch {
      toast.error('Erro ao salvar custos')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card className="border-slate-200 shadow-2xs">
        <CardContent className="p-6 text-center text-sm text-slate-500">Carregando...</CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-slate-200 shadow-2xs">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-indigo-600" />
          Custo de Consultas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!canEdit && (
          <p className="text-xs text-slate-500 mb-4">Você tem permissão apenas de visualização.</p>
        )}
        <form onSubmit={handleSave} className="space-y-4 max-w-md">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Consulta Jurídica (R$)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none z-10">
                R$
              </span>
              <CurrencyInput
                value={consultaJuridica}
                onChange={setConsultaJuridica}
                disabled={!canEdit}
                className="pl-10"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Resumo da IA (R$)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none z-10">
                R$
              </span>
              <CurrencyInput
                value={resumoIa}
                onChange={setResumoIa}
                disabled={!canEdit}
                className="pl-10"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Capa do Processo (R$)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none z-10">
                R$
              </span>
              <CurrencyInput
                value={capaProcesso}
                onChange={setCapaProcesso}
                disabled={!canEdit}
                className="pl-10"
              />
            </div>
          </div>
          {canEdit && (
            <Button
              type="submit"
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              <Save className="h-4 w-4 mr-1.5" />
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
