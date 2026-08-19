import { useState, useEffect } from 'react'
import { getClientes, createCliente, updateCliente, deleteCliente } from '@/services/clientes'
import { getCargos, createCargo, updateCargo, deleteCargo } from '@/services/cargos'
import { getCidades, createCidade, updateCidade, deleteCidade } from '@/services/cidades'
import { getTiposVaga, createTipoVaga, updateTipoVaga, deleteTipoVaga } from '@/services/tipos_vaga'
import {
  getTiposContrato,
  createTipoContrato,
  updateTipoContrato,
  deleteTipoContrato,
} from '@/services/tipos_contrato'
import {
  getDepartamentos,
  createDepartamento,
  updateDepartamento,
  deleteDepartamento,
} from '@/services/departamentos'
import { countReferenceInUse } from '@/services/vacancies'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
import { toast } from 'sonner'
import { PlusCircle, Pencil, Trash2, Database } from 'lucide-react'
import { CostConsultationsForm } from '@/components/CostConsultationsForm'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ClinicasManager } from '@/components/ClinicasManager'
import { BaseIntegracaoManager } from '@/components/BaseIntegracaoManager'
import { SystemParametersForm } from '@/components/SystemParametersForm'
import { UserDepartmentManager } from '@/components/UserDepartmentManager'
import { RecordModel } from 'pocketbase'

type CollectionKey =
  | 'clientes'
  | 'cargos'
  | 'cidades'
  | 'tipos_vaga'
  | 'tipos_contrato'
  | 'departamentos'
  | 'custos_consultas'
  | 'clinicas'
  | 'base_integracao'
  | 'system_parameters'

const CONFIG: Record<
  Exclude<CollectionKey, 'custos_consultas' | 'clinicas' | 'base_integracao' | 'system_parameters'>,
  {
    label: string
    list: () => Promise<RecordModel[]>
    create: (d: { nome: string }) => Promise<RecordModel>
    update: (id: string, d: { nome: string }) => Promise<RecordModel>
    del: (id: string) => Promise<unknown>
  }
> = {
  clientes: {
    label: 'Clientes',
    list: getClientes,
    create: createCliente,
    update: updateCliente,
    del: deleteCliente,
  },
  cargos: {
    label: 'Cargos',
    list: getCargos,
    create: createCargo,
    update: updateCargo,
    del: deleteCargo,
  },
  cidades: {
    label: 'Cidades',
    list: getCidades,
    create: createCidade,
    update: updateCidade,
    del: deleteCidade,
  },
  tipos_vaga: {
    label: 'Tipos de Vaga',
    list: getTiposVaga,
    create: createTipoVaga,
    update: updateTipoVaga,
    del: deleteTipoVaga,
  },
  tipos_contrato: {
    label: 'Tipos de Contrato',
    list: getTiposContrato,
    create: createTipoContrato,
    update: updateTipoContrato,
    del: deleteTipoContrato,
  },
  departamentos: {
    label: 'Departamentos',
    list: getDepartamentos,
    create: createDepartamento,
    update: updateDepartamento,
    del: deleteDepartamento,
  },
}

const FIELD_MAP: Record<
  Exclude<CollectionKey, 'custos_consultas' | 'clinicas' | 'base_integracao' | 'system_parameters'>,
  string
> = {
  clientes: 'cliente',
  cargos: 'cargo',
  cidades: 'cidade',
  tipos_vaga: 'tipo_vaga',
  tipos_contrato: 'tipo_contrato',
  departamentos: '',
}

const REF_TABS = Object.keys(CONFIG) as Exclude<CollectionKey, 'custos_consultas'>[]

export default function ReferenceData() {
  const { isAdmin, isSuperAdmin } = useAuth()
  const canManage = isAdmin || isSuperAdmin
  const [activeTab, setActiveTab] = useState<CollectionKey>('clientes')
  const [records, setRecords] = useState<RecordModel[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [saving, setSaving] = useState(false)

  const [recordToDelete, setRecordToDelete] = useState<{ id: string; nome: string } | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const loadData = async () => {
    if (
      activeTab === 'custos_consultas' ||
      activeTab === 'clinicas' ||
      activeTab === 'base_integracao' ||
      activeTab === 'system_parameters'
    )
      return
    setLoading(true)
    try {
      const data = await CONFIG[activeTab as Exclude<CollectionKey, 'custos_consultas'>].list()
      setRecords(data)
    } catch {
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!canManage && activeTab !== 'custos_consultas') {
      setActiveTab('custos_consultas')
      return
    }
    if (canManage) loadData()
  }, [activeTab, isAdmin, isSuperAdmin])

  const openCreate = () => {
    setEditingId(null)
    setNome('')
    setModalOpen(true)
  }
  const openEdit = (r: RecordModel) => {
    setEditingId(r.id)
    setNome(r.nome)
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) {
      toast.error('Nome é obrigatório')
      return
    }
    setSaving(true)
    try {
      const tab = activeTab as Exclude<CollectionKey, 'custos_consultas'>
      if (editingId) {
        await CONFIG[tab].update(editingId, { nome })
        toast.success('Atualizado!')
      } else {
        await CONFIG[tab].create({ nome })
        toast.success('Criado!')
      }
      setModalOpen(false)
      loadData()
    } catch {
      toast.error('Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const promptDelete = async (r: RecordModel) => {
    const tab = activeTab as Exclude<CollectionKey, 'custos_consultas'>
    const fieldName = FIELD_MAP[tab]
    if (fieldName) {
      const count = await countReferenceInUse(fieldName, r.id)
      if (count > 0) {
        toast.error(`Não é possível excluir: este registro está em uso por ${count} vaga(s).`)
        return
      }
    }
    setRecordToDelete({ id: r.id, nome: r.nome })
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return
    const tab = activeTab as Exclude<CollectionKey, 'custos_consultas'>
    setDeleting(true)
    try {
      await CONFIG[tab].del(recordToDelete.id)
      toast.success('Excluído com sucesso!')
      setDeleteDialogOpen(false)
      setRecordToDelete(null)
      loadData()
    } catch {
      toast.error('Erro ao excluir')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
          <Database className="h-5 w-5 text-indigo-600" />
          <span>Dados de Referência</span>
        </h2>
        <p className="text-xs text-slate-500">
          Gerencie clientes, cargos, cidades e tipos de vaga utilizados nos formulários
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CollectionKey)}>
        <TabsList>
          {canManage &&
            REF_TABS.map((k) => (
              <TabsTrigger key={k} value={k}>
                {CONFIG[k].label}
              </TabsTrigger>
            ))}
          <TabsTrigger value="custos_consultas">Custo de Consultas</TabsTrigger>
          {canManage && <TabsTrigger value="clinicas">Clínicas</TabsTrigger>}
          {canManage && <TabsTrigger value="base_integracao">Base de Integração</TabsTrigger>}
          {isSuperAdmin && (
            <TabsTrigger value="system_parameters">Parâmetros do Sistema</TabsTrigger>
          )}
        </TabsList>

        {canManage &&
          REF_TABS.map((k) => (
            <TabsContent key={k} value={k}>
              <Card className="border-slate-200 shadow-2xs">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-bold text-slate-900">
                    {CONFIG[k].label} ({records.length})
                  </CardTitle>
                  <Button
                    size="sm"
                    onClick={openCreate}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white"
                  >
                    <PlusCircle className="h-4 w-4 mr-1.5" /> Novo
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-xs font-semibold text-slate-600">Nome</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 text-right">
                          Ações
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center py-6 text-slate-500">
                            Carregando...
                          </TableCell>
                        </TableRow>
                      ) : records.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={2}
                            className="text-center py-6 text-slate-500 text-sm"
                          >
                            Nenhum registro cadastrado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        records.map((r) => (
                          <TableRow key={r.id} className="hover:bg-slate-50">
                            <TableCell className="font-semibold text-slate-900 text-sm">
                              {r.nome}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEdit(r)}
                                className="h-8 w-8 text-slate-600 hover:text-amber-600"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => promptDelete(r)}
                                className="h-8 w-8 text-slate-600 hover:text-rose-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          ))}

        <TabsContent value="custos_consultas">
          <CostConsultationsForm />
        </TabsContent>

        {canManage && (
          <TabsContent value="clinicas">
            <ClinicasManager />
          </TabsContent>
        )}

        {canManage && (
          <TabsContent value="base_integracao">
            <BaseIntegracaoManager />
          </TabsContent>
        )}

        {isSuperAdmin && (
          <TabsContent value="system_parameters">
            <SystemParametersForm />
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Editar' : 'Novo'} —{' '}
              {CONFIG[activeTab as Exclude<CollectionKey, 'custos_consultas'>]?.label}
            </DialogTitle>
            <DialogDescription>Digite o nome do registro</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Confirmação de Exclusão"
        description="Deseja realmente excluir este registro?"
        confirmText="Confirmar"
        cancelText="Cancelar"
        variant="destructive"
        loading={deleting}
        onConfirm={handleConfirmDelete}
      />

      {isSuperAdmin && <UserDepartmentManager />}
    </div>
  )
}
