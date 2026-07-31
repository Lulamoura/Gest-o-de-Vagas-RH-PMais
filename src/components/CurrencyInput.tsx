import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'

interface CurrencyInputProps {
  value: number
  onChange: (value: number) => void
  id?: string
  className?: string
  disabled?: boolean
}

function formatBRL(value: number): string {
  const fixed = (value || 0).toFixed(2)
  const parts = fixed.split('.')
  const intPart = parts[0]
  const decPart = parts[1] || '00'
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${formattedInt},${decPart}`
}

function parseBRLToNumber(input: string): number {
  const digits = input.replace(/\D/g, '')
  if (!digits) return 0
  return parseInt(digits, 10) / 100
}

export function CurrencyInput({ value, onChange, id, className, disabled }: CurrencyInputProps) {
  const [display, setDisplay] = useState(formatBRL(value))

  useEffect(() => {
    setDisplay(formatBRL(value))
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numValue = parseBRLToNumber(e.target.value)
    setDisplay(formatBRL(numValue))
    onChange(numValue)
  }

  const handleBlur = () => {
    setDisplay(formatBRL(value))
  }

  return (
    <Input
      id={id}
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
      disabled={disabled}
    />
  )
}
