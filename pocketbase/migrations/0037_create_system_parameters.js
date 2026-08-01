migrate(
  (app) => {
    const collection = new Collection({
      name: 'system_parameters',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.profile = 'superadmin'",
      updateRule: "@request.auth.profile = 'superadmin'",
      deleteRule: "@request.auth.profile = 'superadmin'",
      fields: [
        { name: 'prazo_alerta_dias', type: 'number', required: true, min: 1 },
        { name: 'nome_remetente', type: 'text', required: false },
        { name: 'email_remetente', type: 'email', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(collection)

    var col = app.findCollectionByNameOrId('system_parameters')
    try {
      app.findFirstRecordByData('system_parameters', 'prazo_alerta_dias', 30)
    } catch (_) {
      var rec = new Record(col)
      rec.set('prazo_alerta_dias', 30)
      rec.set('nome_remetente', 'PMais RH')
      rec.set('email_remetente', 'vagas@pmaisservicos.com.br')
      app.save(rec)
    }
  },
  (app) => {
    try {
      var col = app.findCollectionByNameOrId('system_parameters')
      app.delete(col)
    } catch (_) {}
  },
)
