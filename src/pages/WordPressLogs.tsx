import { useState, useEffect, useCallback } from 'react'
import { useRealtime } from '@/hooks/use-realtime'
import {
  pingWordPress,
  getImportLogs,
  testWordPressImportNoToken,
  testWordPressImport,
  WORDPRESS_PING_URL,
  WORDPRESS_IMPORT_URL,
} from '@/services/wordpress'
import { WordpressImportLogRecord, WordpressImportStatus } from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CheckCircle, XCircle, Loader2, AlertTriangle, Copy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

const statusConfig: Record<
  WordpressImportStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  sucesso: { label: 'Sucesso', variant: 'default' },
  duplicada: { label: 'Duplicada', variant: 'secondary' },
  erro: { label: 'Erro', variant: 'destructive' },
}

export default function WordPressLogs() {
  const [logs, setLogs] = useState<WordpressImportLogRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [pingResult, setPingResult] = useState<null | { ok: boolean; error?: string }>(null)
  const [pingLoading, setPingLoading] = useState(false)
  const [noTokenResult, setNoTokenResult] = useState<null | { status: number; body: unknown }>(null)
  const [noTokenLoading, setNoTokenLoading] = useState(false)
  const [token, setToken] = useState('')
  const [tokenTestResult, setTokenTestResult] = useState<null | { status: number; body: unknown }>(
    null,
  )
  const [tokenLoading, setTokenLoading] = useState(false)

  const loadLogs = useCallback(async () => {
    try {
      const data = await getImportLogs()
      setLogs(data)
    } catch {
      toast.error('Erro ao carregar logs de importação')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  useRealtime('wordpress_import_logs', () => {
    loadLogs()
  })

  const handlePing = async () => {
    setPingLoading(true)
    setPingResult(null)
    try {
      const result = await pingWordPress()
      setPingResult({ ok: true })
      toast.success('Ping bem-sucedido! O hook está respondendo.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      setPingResult({ ok: false, error: msg })
      toast.error(`Ping falhou: ${msg}`)
    } finally {
      setPingLoading(false)
    }
  }

  const handleNoTokenTest = async () => {
    setNoTokenLoading(true)
    setNoTokenResult(null)
    try {
      const result = await testWordPressImportNoToken()
      setNoTokenResult(result)
      if (result.status === 401 || result.status === 403) {
        toast.success(`Token validation working: HTTP ${result.status} (expected without token)`)
      } else {
        toast.warning(`Unexpected response: HTTP ${result.status}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      toast.error(`Test failed: ${msg}`)
    } finally {
      setNoTokenLoading(false)
    }
  }

  const handleTokenTest = async () => {
    if (!token.trim()) {
      toast.error('Informe o token de integração')
      return
    }
    setTokenLoading(true)
    setTokenTestResult(null)
    try {
      const testJobId = `diag-${Date.now()}`
      const result = await testWordPressImport(token, {
        wordpress_job_id: testJobId,
        cargo: 'Cargo de Teste',
        cidade: 'São Paulo',
        quantidade_vagas: 1,
      })
      setTokenTestResult(result)
      if (result.status === 200) {
        toast.success('Importação de teste concluída!')
      } else {
        toast.warning(`Resposta HTTP ${result.status}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      toast.error(`Test failed: ${msg}`)
    } finally {
      setTokenLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('URL copiada para a área de transferência')
  }

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integração WordPress</h1>
        <p className="text-muted-foreground mt-1">
          Diagnóstico e logs de importação de vagas via WordPress
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">URLs da API (Backend Skip Cloud)</CardTitle>
          <CardDescription>
            As rotas customizadas do PocketBase NÃO usam o prefixo{' '}
            <code className="font-mono bg-muted px-1 rounded">/api/</code>. Use os caminhos abaixo
            diretamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Ping (Diagnóstico)</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-sm bg-muted px-3 py-2 rounded border">
                POST {WORDPRESS_PING_URL}
              </code>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => copyToClipboard(WORDPRESS_PING_URL)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Importação de Vagas</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-sm bg-muted px-3 py-2 rounded border">
                POST {WORDPRESS_IMPORT_URL}
              </code>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => copyToClipboard(WORDPRESS_IMPORT_URL)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Testar Ping</CardTitle>
            <CardDescription>Verifica se o hook está registrado e respondendo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handlePing} disabled={pingLoading} className="w-full">
              {pingLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {pingLoading ? 'Testando...' : 'Testar Ping'}
            </Button>
            {pingResult && (
              <div className="flex items-center gap-2 text-sm">
                {pingResult.ok ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-green-600">OK — retorno: {'{ ok: true }'}</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-red-600">Erro: {pingResult.error}</span>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Testar sem Token</CardTitle>
            <CardDescription>Deve retornar 401/403 (sem autorização)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={handleNoTokenTest}
              disabled={noTokenLoading}
              variant="outline"
              className="w-full"
            >
              {noTokenLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {noTokenLoading ? 'Testando...' : 'Enviar sem Token'}
            </Button>
            {noTokenResult && (
              <div className="flex items-center gap-2 text-sm">
                {noTokenResult.status === 401 || noTokenResult.status === 403 ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-green-600">HTTP {noTokenResult.status} — esperado ✓</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <span>HTTP {noTokenResult.status} — inesperado</span>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Testar Importação com Token</CardTitle>
          <CardDescription>Envia uma vaga de teste usando o token de integração</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Token de integração (WORDPRESS_INTEGRATION_TOKEN)"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              type="password"
            />
            <Button onClick={handleTokenTest} disabled={tokenLoading}>
              {tokenLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {tokenLoading ? 'Enviando...' : 'Enviar'}
            </Button>
          </div>
          {tokenTestResult && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                {tokenTestResult.status === 200 ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-green-600">HTTP 200 — Sucesso</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <span>HTTP {tokenTestResult.status}</span>
                  </>
                )}
              </div>
              <pre className="text-xs bg-muted p-2 rounded border overflow-x-auto">
                {JSON.stringify(tokenTestResult.body, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Logs de Importação</CardTitle>
          <CardDescription>
            {loading ? 'Carregando...' : `${logs.length} registro(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!loading && logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum log de importação encontrado
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Data/Hora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const cfg = statusConfig[log.status as WordpressImportStatus] || {
                      label: log.status,
                      variant: 'outline' as const,
                    }
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs">{log.wordpress_job_id}</TableCell>
                        <TableCell>
                          <Badge variant={cfg.variant}>{cfg.label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm max-w-xs truncate">
                          {log.mensagem || '—'}
                        </TableCell>
                        <TableCell className="text-sm">{log.origem}</TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {log.data_hora ? new Date(log.data_hora).toLocaleString('pt-BR') : '—'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
