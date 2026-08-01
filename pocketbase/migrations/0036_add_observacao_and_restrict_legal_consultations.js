migrate(
  (app) => {
    var candidatesCol = app.findCollectionByNameOrId('candidates')
    if (!candidatesCol.fields.getByName('observacao')) {
      candidatesCol.fields.add(new TextField({ name: 'observacao' }))
    }
    app.save(candidatesCol)

    var consultasCol = app.findCollectionByNameOrId('candidato_consultas_juridicas')
    consultasCol.listRule =
      "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin'"
    consultasCol.viewRule =
      "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin'"
    app.save(consultasCol)
  },
  (app) => {
    var candidatesCol = app.findCollectionByNameOrId('candidates')
    var field = candidatesCol.fields.getByName('observacao')
    if (field) {
      candidatesCol.fields.remove(field)
      app.save(candidatesCol)
    }

    var consultasCol = app.findCollectionByNameOrId('candidato_consultas_juridicas')
    consultasCol.listRule = "@request.auth.id != ''"
    consultasCol.viewRule = "@request.auth.id != ''"
    app.save(consultasCol)
  },
)
