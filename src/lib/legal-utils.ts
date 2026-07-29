export function getField(obj: Record<string, any> | null | undefined, ...keys: string[]): string {
  if (!obj) return '—'
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== '') return String(obj[k])
  }
  return '—'
}

export function getTopAssuntos(processos: any[]): { label: string; count: number }[] {
  const counts: Record<string, number> = {}
  processos.forEach((p) => {
    const assuntos = p.assuntos || p.assunto
    if (Array.isArray(assuntos)) {
      assuntos.forEach((a) => {
        const text = typeof a === 'string' ? a : getField(a, 'nome', 'descricao')
        if (text && text !== '—') counts[text] = (counts[text] || 0) + 1
      })
    }
    const classe = getField(p, 'classe', 'classe_processual', 'classe_nome')
    if (classe !== '—') counts[classe] = (counts[classe] || 0) + 1
  })
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }))
}

export function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleString('pt-BR')
  } catch {
    return dateStr
  }
}
