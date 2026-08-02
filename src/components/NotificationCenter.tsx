import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import { useRealtime } from '@/hooks/use-realtime'
import { getNotifications, markAsRead, markAllAsRead } from '@/services/notifications'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDateBR } from '@/lib/status-utils'
import { cn } from '@/lib/utils'
import type { NotificationRecord } from '@/types'

const TYPE_LABELS: Record<string, string> = {
  requisition_submitted: 'Requisição enviada',
  requisition_approved: 'Requisição aprovada',
  requisition_reproved: 'Requisição reprovada',
  new_comment: 'Novo comentário',
  change_request_submitted: 'Solicitação de alteração',
  change_request_approved: 'Alteração aprovada',
  change_request_reproved: 'Alteração reprovada',
}

export function NotificationCenter() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const [open, setOpen] = useState(false)

  const loadData = useCallback(async () => {
    try {
      setNotifications(await getNotifications())
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])
  useRealtime('notifications', () => loadData())

  const unreadCount = notifications.filter((n) => !n.read).length

  const handleClick = async (notif: NotificationRecord) => {
    if (!notif.read) await markAsRead(notif.id)
    setOpen(false)
    navigate(`/requisicoes/${notif.requisition}`)
  }

  const handleMarkAll = async () => {
    await markAllAsRead()
    loadData()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-slate-500 hover:text-slate-900 relative"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-indigo-600 text-white text-[10px] font-bold px-1">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <span className="text-sm font-semibold">Notificações</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={handleMarkAll}>
              <CheckCheck className="h-3.5 w-3.5 mr-1" /> Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="h-[320px]">
          {notifications.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhuma notificação</p>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    'w-full text-left p-3 hover:bg-slate-50 transition-colors flex gap-2',
                    !n.read && 'bg-indigo-50/50',
                  )}
                >
                  {!n.read && (
                    <div className="w-2 h-2 rounded-full bg-indigo-600 mt-1.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-900">
                      {TYPE_LABELS[n.type] || 'Notificação'}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5 truncate">{n.message}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {n.created ? formatDateBR(n.created) : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
