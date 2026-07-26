migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!usersCol.fields.getByName('profile')) {
      usersCol.fields.add(
        new SelectField({
          name: 'profile',
          values: ['admin', 'operator', 'viewer'],
          maxSelect: 1,
        }),
      )
      app.save(usersCol)
    }

    const vacancies = new Collection({
      name: 'vacancies',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'cliente', type: 'text', required: true },
        { name: 'cargo', type: 'text', required: true },
        { name: 'cidade', type: 'text' },
        { name: 'quantidade_vagas', type: 'number', min: 1 },
        {
          name: 'tipo_vaga',
          type: 'select',
          values: ['Efetivo', 'Temporário', 'Estágio', 'Terceirizado', 'PJ'],
          maxSelect: 1,
        },
        { name: 'data_abertura', type: 'date' },
        { name: 'data_fechamento', type: 'date' },
        { name: 'data_cancelamento', type: 'date' },
        { name: 'prazo_desejado', type: 'date' },
        {
          name: 'responsavel_rh',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'responsavel_operacional', type: 'text' },
        {
          name: 'status_vaga',
          type: 'select',
          values: [
            'Aberta',
            'Triagem',
            'Entrevistas',
            'Pré-Aprovação',
            'Alocação',
            'Fechada',
            'Cancelada',
          ],
          maxSelect: 1,
        },
        {
          name: 'prioridade',
          type: 'select',
          values: ['Alta', 'Média', 'Baixa'],
          maxSelect: 1,
        },
        { name: 'salario_faixa', type: 'text' },
        { name: 'especificacoes', type: 'text' },
        { name: 'observacoes_internas', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_vacancies_status ON vacancies (status_vaga)',
        'CREATE INDEX idx_vacancies_cliente ON vacancies (cliente)',
      ],
    })
    app.save(vacancies)

    const vacanciesColId = app.findCollectionByNameOrId('vacancies').id

    const candidates = new Collection({
      name: 'candidates',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'vacancy_id',
          type: 'relation',
          collectionId: vacanciesColId,
          maxSelect: 1,
          cascadeDelete: true,
          required: true,
        },
        { name: 'nome', type: 'text', required: true },
        { name: 'email', type: 'email' },
        { name: 'telefone', type: 'text' },
        { name: 'custo_consultas', type: 'number' },
        { name: 'custo_exames', type: 'number' },
        { name: 'custo_testes', type: 'number' },
        { name: 'custo_extras', type: 'number' },
        {
          name: 'status_candidato',
          type: 'select',
          values: [
            'Em análise do gestor',
            'Pré-Aprovado',
            'Integrado',
            'Desistiu',
            'Não aprovado',
            'Rejeitado',
          ],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_candidates_vacancy ON candidates (vacancy_id)',
        'CREATE INDEX idx_candidates_status ON candidates (status_candidato)',
      ],
    })
    app.save(candidates)

    const pipelineHistory = new Collection({
      name: 'pipeline_history',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'vacancy_id',
          type: 'relation',
          collectionId: vacanciesColId,
          maxSelect: 1,
          cascadeDelete: true,
          required: true,
        },
        {
          name: 'usuario_id',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'status_anterior', type: 'text' },
        { name: 'status_novo', type: 'text' },
        { name: 'data_mudanca', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_pipeline_vacancy ON pipeline_history (vacancy_id)'],
    })
    app.save(pipelineHistory)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('pipeline_history'))
      app.delete(app.findCollectionByNameOrId('candidates'))
      app.delete(app.findCollectionByNameOrId('vacancies'))
    } catch (_) {}
  },
)
