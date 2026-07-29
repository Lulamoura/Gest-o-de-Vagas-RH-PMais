migrate(
  (app) => {
    var candidatesColId = app.findCollectionByNameOrId('candidates').id

    var collection = new Collection({
      name: 'candidato_consultas_juridicas',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin'",
      fields: [
        {
          name: 'candidato_id',
          type: 'relation',
          collectionId: candidatesColId,
          maxSelect: 1,
          cascadeDelete: true,
          required: true,
        },
        { name: 'cpf_consultado', type: 'text' },
        { name: 'nome_consultado', type: 'text' },
        { name: 'provider', type: 'text' },
        {
          name: 'status_consulta',
          type: 'select',
          values: ['sucesso', 'erro', 'sem_resultados'],
          maxSelect: 1,
        },
        { name: 'total_processos', type: 'number' },
        { name: 'total_processos_ativos', type: 'number' },
        { name: 'total_processos_inativos', type: 'number' },
        { name: 'resumo_json', type: 'json', maxSize: 10000000 },
        { name: 'estatisticas_json', type: 'json', maxSize: 10000000 },
        { name: 'processos_json', type: 'json', maxSize: 10000000 },
        {
          name: 'consultado_por',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'consultado_em', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'erro', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_consultas_juridicas_candidato ON candidato_consultas_juridicas (candidato_id)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('candidato_consultas_juridicas'))
    } catch (_) {}
  },
)
