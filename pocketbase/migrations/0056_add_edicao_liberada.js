migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('requisitions')

    if (!col.fields.getByName('edicao_liberada')) {
      col.fields.add(new BoolField({ name: 'edicao_liberada' }))
    }

    col.updateRule =
      "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin' || @request.auth.departamento = 'rh' || (status = 'Rascunho' && @request.auth.id = solicitante) || (edicao_liberada = true && @request.auth.id = solicitante)"

    app.save(col)
  },
  (app) => {
    var col = app.findCollectionByNameOrId('requisitions')
    var field = col.fields.getByName('edicao_liberada')
    if (field) {
      col.fields.remove(field)
    }
    col.updateRule =
      "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin' || @request.auth.departamento = 'rh' || (status = 'Rascunho' && @request.auth.id = solicitante)"
    app.save(col)
  },
)
