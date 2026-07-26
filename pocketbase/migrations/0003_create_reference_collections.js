migrate(
  (app) => {
    var referenceFields = [
      { name: 'nome', type: 'text', required: true },
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ]

    var clientes = new Collection({
      name: 'clientes',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.profile = 'admin'",
      updateRule: "@request.auth.profile = 'admin'",
      deleteRule: "@request.auth.profile = 'admin'",
      fields: referenceFields,
    })
    app.save(clientes)

    var cargos = new Collection({
      name: 'cargos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.profile = 'admin'",
      updateRule: "@request.auth.profile = 'admin'",
      deleteRule: "@request.auth.profile = 'admin'",
      fields: referenceFields,
    })
    app.save(cargos)

    var cidades = new Collection({
      name: 'cidades',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.profile = 'admin'",
      updateRule: "@request.auth.profile = 'admin'",
      deleteRule: "@request.auth.profile = 'admin'",
      fields: referenceFields,
    })
    app.save(cidades)

    var tiposVaga = new Collection({
      name: 'tipos_vaga',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.profile = 'admin'",
      updateRule: "@request.auth.profile = 'admin'",
      deleteRule: "@request.auth.profile = 'admin'",
      fields: referenceFields,
    })
    app.save(tiposVaga)

    var clientesId = app.findCollectionByNameOrId('clientes').id
    var cargosId = app.findCollectionByNameOrId('cargos').id
    var cidadesId = app.findCollectionByNameOrId('cidades').id
    var tiposVagaId = app.findCollectionByNameOrId('tipos_vaga').id

    var vacCol = app.findCollectionByNameOrId('vacancies')

    if (!vacCol.fields.getByName('old_cliente')) {
      vacCol.fields.add(new TextField({ name: 'old_cliente' }))
    }
    if (!vacCol.fields.getByName('old_cargo')) {
      vacCol.fields.add(new TextField({ name: 'old_cargo' }))
    }
    if (!vacCol.fields.getByName('old_cidade')) {
      vacCol.fields.add(new TextField({ name: 'old_cidade' }))
    }
    if (!vacCol.fields.getByName('old_tipo_vaga')) {
      vacCol.fields.add(new TextField({ name: 'old_tipo_vaga' }))
    }
    app.save(vacCol)

    app
      .db()
      .newQuery(
        'UPDATE vacancies SET old_cliente = cliente, old_cargo = cargo, old_cidade = cidade, old_tipo_vaga = tipo_vaga',
      )
      .execute()

    var vacCol2 = app.findCollectionByNameOrId('vacancies')
    vacCol2.fields.removeByName('cliente')
    vacCol2.fields.removeByName('cargo')
    vacCol2.fields.removeByName('cidade')
    vacCol2.fields.removeByName('tipo_vaga')

    vacCol2.fields.add(
      new RelationField({
        name: 'cliente',
        collectionId: clientesId,
        maxSelect: 1,
        cascadeDelete: false,
      }),
    )
    vacCol2.fields.add(
      new RelationField({
        name: 'cargo',
        collectionId: cargosId,
        maxSelect: 1,
        cascadeDelete: false,
      }),
    )
    vacCol2.fields.add(
      new RelationField({
        name: 'cidade',
        collectionId: cidadesId,
        maxSelect: 1,
        cascadeDelete: false,
      }),
    )
    vacCol2.fields.add(
      new RelationField({
        name: 'tipo_vaga',
        collectionId: tiposVagaId,
        maxSelect: 1,
        cascadeDelete: false,
      }),
    )
    app.save(vacCol2)
  },
  (app) => {
    try {
      var vacCol = app.findCollectionByNameOrId('vacancies')
      try {
        vacCol.fields.removeByName('cliente')
      } catch (_) {}
      try {
        vacCol.fields.removeByName('cargo')
      } catch (_) {}
      try {
        vacCol.fields.removeByName('cidade')
      } catch (_) {}
      try {
        vacCol.fields.removeByName('tipo_vaga')
      } catch (_) {}
      try {
        vacCol.fields.removeByName('old_cliente')
      } catch (_) {}
      try {
        vacCol.fields.removeByName('old_cargo')
      } catch (_) {}
      try {
        vacCol.fields.removeByName('old_cidade')
      } catch (_) {}
      try {
        vacCol.fields.removeByName('old_tipo_vaga')
      } catch (_) {}
      vacCol.fields.add(new TextField({ name: 'cliente', required: true }))
      vacCol.fields.add(new TextField({ name: 'cargo', required: true }))
      vacCol.fields.add(new TextField({ name: 'cidade' }))
      vacCol.fields.add(
        new SelectField({
          name: 'tipo_vaga',
          values: ['Efetivo', 'Temporário', 'Estágio', 'Terceirizado', 'PJ'],
          maxSelect: 1,
        }),
      )
      app.save(vacCol)
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('tipos_vaga'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('cidades'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('cargos'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('clientes'))
    } catch (_) {}
  },
)
