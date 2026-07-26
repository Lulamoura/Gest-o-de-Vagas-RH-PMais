import pb from '@/lib/pocketbase/client'
import { VacancyRecord } from '@/types'

export const getVacancies = async () => {
  return pb.collection<VacancyRecord>('vacancies').getFullList({
    sort: '-created',
    expand: 'responsavel_rh',
  })
}

export const getVacancy = async (id: string) => {
  return pb.collection<VacancyRecord>('vacancies').getOne(id, {
    expand: 'responsavel_rh',
  })
}

export const createVacancy = async (data: Partial<VacancyRecord>) => {
  return pb.collection<VacancyRecord>('vacancies').create(data)
}

export const updateVacancy = async (id: string, data: Partial<VacancyRecord>) => {
  return pb.collection<VacancyRecord>('vacancies').update(id, data)
}

export const deleteVacancy = async (id: string) => {
  return pb.collection<VacancyRecord>('vacancies').delete(id)
}
