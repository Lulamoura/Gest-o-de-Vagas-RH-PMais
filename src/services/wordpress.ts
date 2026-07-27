import pb from '@/lib/pocketbase/client'
import { WordpressImportLogRecord } from '@/types'

const BACKEND_URL = import.meta.env.VITE_POCKETBASE_URL

export const WORDPRESS_IMPORT_URL = `${BACKEND_URL}/backend/v1/vagas/wordpress`
export const WORDPRESS_PING_URL = `${BACKEND_URL}/backend/v1/ping-wordpress`

export const pingWordPress = async (): Promise<{ ok: boolean }> => {
  return pb.send('/backend/v1/ping-wordpress', { method: 'POST' })
}

export const getImportLogs = async (): Promise<WordpressImportLogRecord[]> => {
  return pb
    .collection<WordpressImportLogRecord>('wordpress_import_logs')
    .getFullList({ sort: '-data_hora' })
}

export const testWordPressImport = async (
  token: string,
  data: Record<string, unknown>,
): Promise<{ status: number; body: unknown }> => {
  const res = await fetch(WORDPRESS_IMPORT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  })
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body }
}

export const testWordPressImportNoToken = async (): Promise<{
  status: number
  body: unknown
}> => {
  const res = await fetch(WORDPRESS_IMPORT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wordpress_job_id: 'test-no-token' }),
  })
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body }
}
