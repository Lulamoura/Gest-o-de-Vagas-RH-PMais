export const renderStarsAsText = (rank?: number | null): string => {
  if (rank == null) return '—'
  const r = Math.max(0, Math.min(5, Math.round(rank)))
  return '★'.repeat(r) + '☆'.repeat(5 - r)
}

export const getFilterSummary = (
  monthFilter: string,
  periodStart: string,
  periodEnd: string,
  clientFilter: string,
  clientesList: { id: string; nome: string }[],
): string => {
  const period = periodStart && periodEnd ? `${periodStart} a ${periodEnd}` : monthFilter
  const client =
    clientFilter === 'ALL'
      ? 'Todos os clientes'
      : clientesList.find((c) => c.id === clientFilter)?.nome || 'Todos os clientes'
  return `Período: ${period} | Cliente: ${client}`
}
