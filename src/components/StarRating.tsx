import { useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StarRatingProps {
  value?: number | null
  onChange?: (value: number | null) => void
  readOnly?: boolean
  size?: number
  className?: string
}

export function StarRating({
  value,
  onChange,
  readOnly = false,
  size = 18,
  className,
}: StarRatingProps) {
  const [hover, setHover] = useState<number | null>(null)
  const displayValue = hover ?? value ?? 0

  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onMouseEnter={() => !readOnly && setHover(star)}
          onMouseLeave={() => !readOnly && setHover(null)}
          onClick={() => {
            if (readOnly) return
            if (onChange) {
              onChange(star === value ? null : star)
            }
          }}
          className={cn(
            'transition-transform',
            !readOnly && 'hover:scale-110 cursor-pointer',
            readOnly && 'cursor-default',
          )}
          aria-label={`${star} estrela${star > 1 ? 's' : ''}`}
        >
          <Star
            width={size}
            height={size}
            className={cn(
              star <= displayValue
                ? 'fill-amber-400 text-amber-400'
                : 'fill-transparent text-slate-300',
            )}
          />
        </button>
      ))}
    </div>
  )
}
