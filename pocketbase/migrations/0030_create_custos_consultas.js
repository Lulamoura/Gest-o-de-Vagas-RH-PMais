migrate(
  (app) => {
    const collection = new Collection({
      name: 'custos_consultas',
      type: 'base',
      listRule:
        '@request.auth.profile = "admin" || @request.auth.profile = "superadmin" || @request.auth.profile = "operator" || @request.auth.profile = "viewer"',
      viewRule:
        '@request.auth.profile = "admin" || @request.auth.profile = "superadmin" || @request.auth.profile = "operator" || @request.auth.profile = "viewer"',
      createRule: '@request.auth.profile = "admin" || @request.auth.profile = "superadmin"',
      updateRule: '@request.auth.profile = "admin" || @request.auth.profile = "superadmin"',
      deleteRule: '@request.auth.profile = "admin" || @request.auth.profile = "superadmin"',
      fields: [
        { name: 'consulta_juridica', type: 'number', required: true, min: 0 },
        { name: 'resumo_ia', type: 'number', required: true, min: 0 },
        { name: 'capa_processo', type: 'number', required: true, min: 0 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('custos_consultas')
    app.delete(collection)
  },
)
