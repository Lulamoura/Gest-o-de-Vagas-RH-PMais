import pb from '@/lib/pocketbase/client'
import { NotificationRecord } from '@/types'

export const getNotifications = async () =>
  pb.collection<NotificationRecord>('notifications').getFullList({
    sort: '-created',
    expand: 'requisition',
  })

export const markAsRead = async (id: string) =>
  pb.collection<NotificationRecord>('notifications').update(id, { read: true })

export const markAllAsRead = async () => {
  const unread = await pb.collection<NotificationRecord>('notifications').getFullList({
    filter: 'read = false',
  })
  await Promise.all(unread.map((n) => pb.collection('notifications').update(n.id, { read: true })))
}
