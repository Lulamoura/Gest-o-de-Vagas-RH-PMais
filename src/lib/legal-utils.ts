export function getField(obj: Record<string, any> | null | undefined, ...keys: string[]): string {
  if (!obj) return '—'
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== '') return String(obj[k])
  }
  return '—'
}

export function getNestedField(
  obj: Record<string, any> | null | undefined,
  ...paths: string[]
): string {
  if (!obj) return '—'
  for (const path of paths) {
    const parts = path.split('.')
    let cur: any = obj
    let found = true
    for (const p of parts) {
      if (cur == null || typeof cur !== 'object') {
        found = false
        break
      }
      cur = cur[p]
    }
    if (found && cur != null && cur !== '') return String(cur)
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
    if (!Array.isArray(assuntos)) {
      const capaAssunto = getNestedField(p, 'capa.assunto', 'capa.assunto_principal')
      if (capaAssunto !== '—') counts[capaAssunto] = (counts[capaAssunto] || 0) + 1
    }
    const classe = getNestedField(p, 'classe.nome', 'classe_processual', 'classe_nome', 'classe')
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
