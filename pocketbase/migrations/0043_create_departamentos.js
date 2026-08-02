migrate(
  (app) => {
    var departamentos = new Collection({
      name: 'departamentos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin'",
      updateRule: "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin'",
      deleteRule: "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin'",
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(departamentos)

    var seedNames = ['Comercial', 'Operacional', 'RH']
    for (var i = 0; i < seedNames.length; i++) {
      try {
        app.findFirstRecordByData('departamentos', 'nome', seedNames[i])
      } catch (_) {
        var col = app.findCollectionByNameOrId('departamentos')
        var rec = new Record(col)
        rec.set('nome', seedNames[i])
        app.save(rec)
      }
    }
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('departamentos'))
    } catch (_) {}
  },
)
