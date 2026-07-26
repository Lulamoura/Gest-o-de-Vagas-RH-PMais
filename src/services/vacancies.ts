import pb from '@/lib/pocketbase/client'
import { VacancyRecord } from '@/types'

const EXPAND = 'responsavel_rh,cliente,cargo,cidade,tipo_vaga'

export const getVacancies = async () => {
  return pb.collection<VacancyRecord>('vacancies').getFullList({
    sort: '-created',
    expand: EXPAND,
  })
}

export const getVacancy = async (id: string) => {
  return pb.collection<VacancyRecord>('vacancies').getOne(id, {
    expand: EXPAND,
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
