import pb from '@/lib/pocketbase/client'
import { EmailTemplateRecord } from '@/types'

export const getEmailTemplates = async () => {
  return pb.collection<EmailTemplateRecord>('email_templates').getFullList({
    sort: 'type',
  })
}

export const getEmailTemplate = async (id: string) => {
  return pb.collection<EmailTemplateRecord>('email_templates').getOne(id)
}

export const updateEmailTemplate = async (id: string, data: { subject: string; body: string }) => {
  return pb.collection<EmailTemplateRecord>('email_templates').update(id, data)
}
