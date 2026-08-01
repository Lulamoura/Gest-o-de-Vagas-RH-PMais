migrate(
  (app) => {
    var usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!usersCol.fields.getByName('departamento')) {
      usersCol.fields.add(
        new SelectField({
          name: 'departamento',
          values: ['comercial', 'operacional', 'rh'],
          maxSelect: 1,
        }),
      )
    }
    app.save(usersCol)

    var usersId = '_pb_users_auth_'
    var clientesId = app.findCollectionByNameOrId('clientes').id
    var cargosId = app.findCollectionByNameOrId('cargos').id
    var cidadesId = app.findCollectionByNameOrId('cidades').id
    var tiposVagaId = app.findCollectionByNameOrId('tipos_vaga').id
    var tiposContratoId = app.findCollectionByNameOrId('tipos_contrato').id

    var requisitions = new Collection({
      name: 'requisitions',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule:
        "@request.auth.profile = 'operator' || @request.auth.profile = 'admin' || @request.auth.profile = 'superadmin'",
      updateRule:
        "status = 'Rascunho' && (@request.auth.id = solicitante || @request.auth.profile = 'admin' || @request.auth.profile = 'superadmin')",
      deleteRule: "@request.auth.profile = 'superadmin'",
      fields: [
        {
          name: 'solicitante',
          type: 'relation',
          collectionId: usersId,
          maxSelect: 1,
          cascadeDelete: false,
          required: true,
        },
        {
          name: 'departamento',
          type: 'select',
          values: ['comercial', 'operacional', 'rh'],
          maxSelect: 1,
        },
        {
          name: 'cliente',
          type: 'relation',
          collectionId: clientesId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'cargo',
          type: 'relation',
          collectionId: cargosId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'cidade',
          type: 'relation',
          collectionId: cidadesId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'tipo_vaga',
          type: 'relation',
          collectionId: tiposVagaId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'tipo_contrato',
          type: 'relation',
          collectionId: tiposContratoId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'quantidade_vagas', type: 'number', min: 1, onlyInt: true },
        { name: 'prazo_desejado', type: 'date' },
        {
          name: 'prioridade',
          type: 'select',
          values: ['Alta', 'Média', 'Baixa'],
          maxSelect: 1,
        },
        { name: 'faixa_salarial', type: 'text' },
        { name: 'justificativa', type: 'text', required: true },
        { name: 'especificacoes', type: 'text' },
        { name: 'observacoes_internas', type: 'text' },
        {
          name: 'status',
          type: 'select',
          values: ['Rascunho', 'Aguardando aprovação'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_requisitions_status ON requisitions (status)',
        'CREATE INDEX idx_requisitions_solicitante ON requisitions (solicitante)',
        'CREATE INDEX idx_requisitions_departamento ON requisitions (departamento)',
        'CREATE INDEX idx_requisitions_created ON requisitions (created DESC)',
      ],
    })
    app.save(requisitions)
  },
  (app) => {
    try {
      var usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      usersCol.fields.removeByName('departamento')
      app.save(usersCol)
    } catch (_) {}

    try {
      app.delete(app.findCollectionByNameOrId('requisitions'))
    } catch (_) {}
  },
)
