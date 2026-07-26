migrate(
  (app) => {
    const tiposContrato = new Collection({
      name: 'tipos_contrato',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.profile = 'admin'",
      updateRule: "@request.auth.profile = 'admin'",
      deleteRule: "@request.auth.profile = 'admin'",
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_tipos_contrato_nome ON tipos_contrato (nome)'],
    })
    app.save(tiposContrato)

    var seedValues = ['CLT', 'Mão de Obra Temporária', 'PJ', 'Intermitente', 'RPA']
    var col = app.findCollectionByNameOrId('tipos_contrato')
    for (var i = 0; i < seedValues.length; i++) {
      try {
        app.findFirstRecordByData('tipos_contrato', 'nome', seedValues[i])
      } catch (_) {
        var rec = new Record(col)
        rec.set('nome', seedValues[i])
        app.save(rec)
      }
    }

    var tiposContratoId = app.findCollectionByNameOrId('tipos_contrato').id
    var vacCol = app.findCollectionByNameOrId('vacancies')
    if (!vacCol.fields.getByName('tipo_contrato')) {
      vacCol.fields.add(
        new RelationField({
          name: 'tipo_contrato',
          collectionId: tiposContratoId,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
      app.save(vacCol)
    }
  },
  (app) => {
    try {
      var vacCol = app.findCollectionByNameOrId('vacancies')
      var field = vacCol.fields.getByName('tipo_contrato')
      if (field) {
        vacCol.fields.remove(field)
        app.save(vacCol)
      }
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('tipos_contrato'))
    } catch (_) {}
  },
)
