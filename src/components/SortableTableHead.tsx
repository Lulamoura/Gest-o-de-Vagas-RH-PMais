import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { TableHead } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type SortDirection = 'asc' | 'desc'

interface SortableHeaderProps {
  label: string
  column: string
  sortColumn: string
  sortDirection: SortDirection
  onSort: (column: string) => void
  className?: string
  align?: 'left' | 'right'
}

export function SortableHeader({
  label,
  column,
  sortColumn,
  sortDirection,
  onSort,
  className,
  align = 'left',
}: SortableHeaderProps) {
  const isActive = sortColumn === column
  return (
    <TableHead
      className={cn('cursor-pointer select-none hover:bg-slate-100 transition-colors', className)}
      onClick={() => onSort(column)}
    >
      <div className={cn('flex items-center gap-1', align === 'right' && 'justify-end')}>
        <span className="text-xs font-semibold text-slate-600">{label}</span>
        {isActive ? (
          sortDirection === 'asc' ? (
            <ChevronUp className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
          )
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 text-slate-300 shrink-0" />
        )}
      </div>
    </TableHead>
  )
}
