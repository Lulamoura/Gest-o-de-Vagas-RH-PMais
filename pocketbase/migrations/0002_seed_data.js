migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    let adminId = ''

    try {
      const existing = app.findAuthRecordByEmail(
        '_pb_users_auth_',
        'luiz.moura@pmaisservicos.com.br',
      )
      adminId = existing.id
      existing.set('profile', 'admin')
      existing.set('name', 'Luiz Moura')
      app.save(existing)
    } catch (_) {
      const admin = new Record(users)
      admin.setEmail('luiz.moura@pmaisservicos.com.br')
      admin.setPassword('Skip@Pass')
      admin.setVerified(true)
      admin.set('name', 'Luiz Moura')
      admin.set('profile', 'admin')
      app.save(admin)
      adminId = admin.id
    }

    // Check if vacancies already seeded
    try {
      app.findFirstRecordByData('vacancies', 'cliente', 'Petrobras')
      return // Already seeded
    } catch (_) {}

    const vacanciesCol = app.findCollectionByNameOrId('vacancies')
    const candidatesCol = app.findCollectionByNameOrId('candidates')
    const historyCol = app.findCollectionByNameOrId('pipeline_history')

    const sampleVacancies = [
      {
        cliente: 'Petrobras',
        cargo: 'Engenheiro de Processos Sênior',
        cidade: 'Rio de Janeiro - RJ',
        quantidade_vagas: 2,
        tipo_vaga: 'Efetivo',
        data_abertura: '2026-06-10 09:00:00.000Z',
        prazo_desejado: '2026-07-30 00:00:00.000Z',
        responsavel_rh: adminId,
        responsavel_operacional: 'Carlos Silva (Gerente Operações)',
        status_vaga: 'Entrevistas',
        prioridade: 'Alta',
        salario_faixa: 'R$ 14.000,00 - R$ 18.000,00',
        especificacoes:
          'Experiência com refino, segurança de processos e ISO 9001. Inglês fluente.',
        observacoes_internas: 'Cliente prioriza profissionais com CREA ativo.',
      },
      {
        cliente: 'Vale S.A.',
        cargo: 'Analista de Manutenção Preditiva',
        cidade: 'Belo Horizonte - MG',
        quantidade_vagas: 3,
        tipo_vaga: 'Efetivo',
        data_abertura: '2026-05-15 10:00:00.000Z',
        prazo_desejado: '2026-06-30 00:00:00.000Z',
        responsavel_rh: adminId,
        responsavel_operacional: 'Mariana Costa',
        status_vaga: 'Aberta',
        prioridade: 'Alta',
        salario_faixa: 'R$ 8.500,00 - R$ 11.000,00',
        especificacoes: 'Conhecimento em vibração, termografia e óleo lubrificante. SAP PM.',
        observacoes_internas: 'Vaga parada há mais de 60 dias devido a redefinição de perfil.',
      },
      {
        cliente: 'Suzano Paper',
        cargo: 'Técnico em Logística de Transporte',
        cidade: 'Suzano - SP',
        quantidade_vagas: 1,
        tipo_vaga: 'Temporário',
        data_abertura: '2026-07-01 08:30:00.000Z',
        prazo_desejado: '2026-08-01 00:00:00.000Z',
        responsavel_rh: adminId,
        responsavel_operacional: 'Roberto Almeida',
        status_vaga: 'Pré-Aprovação',
        prioridade: 'Média',
        salario_faixa: 'R$ 4.500,00',
        especificacoes: 'Gestão de frota, roteirização e sistema TOTVS.',
        observacoes_internas: 'Candidato final em aprovação pela diretoria.',
      },
      {
        cliente: 'Ambev',
        cargo: 'Coordenador de Qualidade e Meio Ambiente',
        cidade: 'Jaguariúna - SP',
        quantidade_vagas: 1,
        tipo_vaga: 'Efetivo',
        data_abertura: '2026-06-20 11:00:00.000Z',
        data_fechamento: '2026-07-20 17:00:00.000Z',
        prazo_desejado: '2026-07-25 00:00:00.000Z',
        responsavel_rh: adminId,
        responsavel_operacional: 'Fernanda Lima',
        status_vaga: 'Fechada',
        prioridade: 'Média',
        salario_faixa: 'R$ 12.000,00',
        especificacoes: 'Gestão de requisitos ISO 14001 e ISO 45001. Liderança de equipe.',
        observacoes_internas: 'Processo concluído dentro do prazo esperado.',
      },
      {
        cliente: 'Gerdau',
        cargo: 'Especialista em Automação Industrial',
        cidade: 'Ouro Branco - MG',
        quantidade_vagas: 2,
        tipo_vaga: 'Efetivo',
        data_abertura: '2026-05-01 09:00:00.000Z',
        prazo_desejado: '2026-06-15 00:00:00.000Z',
        responsavel_rh: adminId,
        responsavel_operacional: 'Lucas Mendes',
        status_vaga: 'Triagem',
        prioridade: 'Alta',
        salario_faixa: 'R$ 10.000,00 - R$ 13.500,00',
        especificacoes: 'Programação de CLP Siemens S7, SCADA e redes industriais Profinet.',
        observacoes_internas: 'Vaga atrasada! Baixa quantidade de currículos aderentes.',
      },
    ]

    const createdVacancies = []

    for (const item of sampleVacancies) {
      const rec = new Record(vacanciesCol)
      for (const key in item) {
        rec.set(key, item[key])
      }
      app.save(rec)
      createdVacancies.push(rec)
    }

    // Seed sample candidates
    const sampleCandidates = [
      {
        vacancy_id: createdVacancies[0].id,
        nome: 'Juliana Rocha',
        email: 'juliana.rocha@email.com',
        telefone: '(21) 98877-6655',
        custo_consultas: 150,
        custo_exames: 300,
        custo_testes: 200,
        custo_extras: 50,
        status_candidato: 'Em análise do gestor',
      },
      {
        vacancy_id: createdVacancies[0].id,
        nome: 'Marcos Paulo Santos',
        email: 'marcos.santos@email.com',
        telefone: '(21) 97766-5544',
        custo_consultas: 150,
        custo_exames: 350,
        custo_testes: 200,
        custo_extras: 0,
        status_candidato: 'Pré-Aprovado',
      },
      {
        vacancy_id: createdVacancies[2].id,
        nome: 'Renata Oliveira',
        email: 'renata.oliveira@email.com',
        telefone: '(11) 96655-4433',
        custo_consultas: 120,
        custo_exames: 250,
        custo_testes: 150,
        custo_extras: 100,
        status_candidato: 'Pré-Aprovado',
      },
      {
        vacancy_id: createdVacancies[3].id,
        nome: 'Gabriel Duarte',
        email: 'gabriel.duarte@email.com',
        telefone: '(19) 95544-3322',
        custo_consultas: 200,
        custo_exames: 400,
        custo_testes: 250,
        custo_extras: 0,
        status_candidato: 'Integrado',
      },
    ]

    for (const item of sampleCandidates) {
      const rec = new Record(candidatesCol)
      for (const key in item) {
        rec.set(key, item[key])
      }
      app.save(rec)
    }

    // Seed pipeline history
    const sampleHistory = [
      {
        vacancy_id: createdVacancies[0].id,
        usuario_id: adminId,
        status_anterior: 'Aberta',
        status_novo: 'Triagem',
      },
      {
        vacancy_id: createdVacancies[0].id,
        usuario_id: adminId,
        status_anterior: 'Triagem',
        status_novo: 'Entrevistas',
      },
      {
        vacancy_id: createdVacancies[2].id,
        usuario_id: adminId,
        status_anterior: 'Entrevistas',
        status_novo: 'Pré-Aprovação',
      },
      {
        vacancy_id: createdVacancies[3].id,
        usuario_id: adminId,
        status_anterior: 'Alocação',
        status_novo: 'Fechada',
      },
    ]

    for (const item of sampleHistory) {
      const rec = new Record(historyCol)
      for (const key in item) {
        rec.set(key, item[key])
      }
      app.save(rec)
    }
  },
  (app) => {},
)
