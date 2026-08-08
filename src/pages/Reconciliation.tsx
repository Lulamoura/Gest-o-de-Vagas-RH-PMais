import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { executeReconciliation, type ReconciliationResult } from '@/services/reconciliation'
import { ReconciliationSnapshotView } from '@/components/ReconciliationSnapshotView'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

export default function Reconciliation() {
  const [vacancyId, setVacancyId] = useState('rhjbe8yij573rh4')
  const [reqId, setReqId] = useState('v2hmxeyfzing4fu')
  const [wpJobId, setWpJobId] = useState('72070')
  const [first, setFirst] = useState<ReconciliationResult | null>(null)
  const [second, setSecond] = useState<ReconciliationResult | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (which: 'first' | 'second') => {
    setLoading(which)
    setError(null)
    try {
      const result = await executeReconciliation({
        vacancy_id: vacancyId,
        requisition_id: reqId,
        wordpress_job_id: wpJobId,
      })
      if (which === 'first') {
        setFirst(result)
        setSecond(null)
      } else setSecond(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(null)
    }
  }

  const idempotent = !!(
    first &&
    second &&
    first.post_snapshot?.vacancy?.updated === second.post_snapshot?.vacancy?.updated &&
    second.post_snapshot?.vacancy_count === 1
  )

  const allPassed = !!(
    first?.ok &&
    first.post_snapshot?.vacancy_count === 1 &&
    first.post_snapshot?.requisition?.status === 'Publicada' &&
    second?.ok &&
    idempotent
  )

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Reconciliação de Vaga</h1>
        <p className="text-muted-foreground">
          Executar reconciliação via POST /backend/v1/vagas/wordpress e verificar idempotência
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Parâmetros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <Label>Vacancy ID</Label>
            <Input value={vacancyId} onChange={(e) => setVacancyId(e.target.value)} />
          </div>
          <div>
            <Label>Requisition ID</Label>
            <Input value={reqId} onChange={(e) => setReqId(e.target.value)} />
          </div>
          <div>
            <Label>WordPress Job ID</Label>
            <Input value={wpJobId} onChange={(e) => setWpJobId(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => run('first')} disabled={!!loading}>
          {loading === 'first' ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Executando...
            </>
          ) : (
            '1ª Chamada — Reconciliar'
          )}
        </Button>
        <Button onClick={() => run('second')} disabled={!!loading || !first?.ok} variant="outline">
          {loading === 'second' ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Executando...
            </>
          ) : (
            '2ª Chamada — Idempotência'
          )}
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          </CardContent>
        </Card>
      )}

      {first && (
        <>
          <ReconciliationSnapshotView
            title="Pré-execução (1ª chamada)"
            snapshot={first.pre_snapshot}
            requisitionId={reqId}
          />
          <ReconciliationSnapshotView
            title="Pós-execução (1ª chamada)"
            snapshot={first.post_snapshot}
            requisitionId={reqId}
          />
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center gap-3">
                {first.ok ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
                <span>
                  Import Status: <Badge>{first.import_status}</Badge>
                </span>
                <span className="text-xs text-muted-foreground">
                  Response: {JSON.stringify(first.import_response)}
                </span>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {second && (
        <>
          <ReconciliationSnapshotView
            title="Pré-execução (2ª chamada)"
            snapshot={second.pre_snapshot}
            requisitionId={reqId}
          />
          <ReconciliationSnapshotView
            title="Pós-execução (2ª chamada)"
            snapshot={second.post_snapshot}
            requisitionId={reqId}
          />
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                {idempotent ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
                <span>
                  Idempotência:{' '}
                  {idempotent
                    ? 'Confirmada (updated inalterado, sem duplicatas)'
                    : 'Falhou — verificar snapshots'}
                </span>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {first && second && (
        <Card className={allPassed ? 'border-green-600' : 'border-destructive'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {allPassed ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-destructive" />
              )}
              Conclusão
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allPassed ? (
              <p className="text-sm text-muted-foreground">
                Reconciliação concluída com sucesso. Vaga atualizada, requisição em Publicada,
                idempotência confirmada, sem duplicatas.
              </p>
            ) : (
              <p className="text-sm text-destructive">
                Verificação falhou. Revise os snapshots acima.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
