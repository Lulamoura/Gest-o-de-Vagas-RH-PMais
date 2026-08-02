import pb from '@/lib/pocketbase/client'
import { UserRecord } from '@/types'

export const getUsers = async () => {
  return pb.collection<UserRecord>('users').getFullList({
    sort: 'name',
    expand: 'departamento',
  })
}

export const createUser = async (data: {
  name: string
  email: string
  password?: string
  passwordConfirm?: string
  profile?: 'admin' | 'operator' | 'viewer' | 'superadmin'
  departamento?: string
}) => {
  return pb.collection<UserRecord>('users').create({
    ...data,
    passwordConfirm: data.passwordConfirm || data.password,
  })
}

export const updateUser = async (
  id: string,
  data: Partial<UserRecord>,
  params?: { expand?: string },
) => {
  return pb.collection<UserRecord>('users').update(id, data, params)
}

export const deleteUser = async (id: string) => {
  return pb.collection<UserRecord>('users').delete(id)
}
