export function cleanCPF(cpf: string): string {
  return (cpf || '').replace(/\D/g, '')
}

export function formatCPF(cpf: string): string {
  const c = cleanCPF(cpf)
  if (c.length !== 11) return cpf || '—'
  return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`
}

export function validateCPF(cpf: string): boolean {
  const c = cleanCPF(cpf)
  if (c.length !== 11) return false
  if (/^(\d)\1{10}$/.test(c)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(c[i]) * (10 - i)
  let rev = 11 - (sum % 11)
  if (rev >= 10) rev = 0
  if (rev !== parseInt(c[9])) return false

  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(c[i]) * (11 - i)
  rev = 11 - (sum % 11)
  if (rev >= 10) rev = 0
  if (rev !== parseInt(c[10])) return false

  return true
}
