migrate(
  (app) => {
    const referenceCollections = ['clientes', 'cargos', 'cidades', 'tipos_vaga', 'tipos_contrato']

    for (const name of referenceCollections) {
      const col = app.findCollectionByNameOrId(name)
      col.createRule = "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin'"
      col.updateRule = "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin'"
      col.deleteRule = "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin'"
      app.save(col)
    }
  },
  (app) => {
    const referenceCollections = ['clientes', 'cargos', 'cidades', 'tipos_vaga', 'tipos_contrato']

    for (const name of referenceCollections) {
      const col = app.findCollectionByNameOrId(name)
      col.createRule = "@request.auth.profile = 'admin'"
      col.updateRule = "@request.auth.profile = 'admin'"
      col.deleteRule = "@request.auth.profile = 'admin'"
      app.save(col)
    }
  },
)
