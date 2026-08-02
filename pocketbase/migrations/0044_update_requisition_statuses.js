migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('requisitions')

    col.fields.removeByName('status')
    col.fields.add(
      new SelectField({
        name: 'status',
        values: [
          'Rascunho',
          'Aguardando aprovação',
          'Em análise',
          'Aprovada',
          'Reprovada',
          'Cancelada',
        ],
        maxSelect: 1,
      }),
    )

    col.updateRule =
      "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin' || @request.auth.departamento = 'rh' || (status = 'Rascunho' && @request.auth.id = solicitante)"

    app.save(col)
  },
  (app) => {
    var col = app.findCollectionByNameOrId('requisitions')
    col.fields.removeByName('status')
    col.fields.add(
      new SelectField({
        name: 'status',
        values: ['Rascunho', 'Aguardando aprovação'],
        maxSelect: 1,
      }),
    )
    col.updateRule =
      "status = 'Rascunho' && (@request.auth.id = solicitante || @request.auth.profile = 'admin' || @request.auth.profile = 'superadmin')"
    app.save(col)
  },
)
