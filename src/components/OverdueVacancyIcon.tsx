import { AlertTriangle } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface OverdueVacancyIconProps {
  className?: string
  iconClassName?: string
}

export function OverdueVacancyIcon({ className, iconClassName }: OverdueVacancyIconProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn('inline-flex items-center', className)}
          role="img"
          aria-label="Vagas em Atraso — ação necessária"
        >
          <AlertTriangle className={cn('h-4 w-4 text-rose-600', iconClassName)} />
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p>Vagas em Atraso — ação necessária</p>
      </TooltipContent>
    </Tooltip>
  )
}
