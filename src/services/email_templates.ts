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

export const sendTestEmail = async (data: {
  type: string
  subject: string
  body: string
  test_email?: string
}) => {
  return pb.send('/backend/v1/test-send-email', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })
}
