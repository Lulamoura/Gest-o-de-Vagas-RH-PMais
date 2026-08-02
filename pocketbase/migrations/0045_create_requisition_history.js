migrate(
  (app) => {
    var requisitionsId = app.findCollectionByNameOrId('requisitions').id
    var usersId = '_pb_users_auth_'

    var collection = new Collection({
      name: 'requisition_history',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin'",
      deleteRule: "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin'",
      fields: [
        {
          name: 'requisition_id',
          type: 'relation',
          collectionId: requisitionsId,
          maxSelect: 1,
          cascadeDelete: true,
          required: true,
        },
        {
          name: 'usuario_id',
          type: 'relation',
          collectionId: usersId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'status_anterior', type: 'text' },
        { name: 'status_novo', type: 'text', required: true },
        { name: 'acao', type: 'text' },
        { name: 'observacao', type: 'text' },
        { name: 'data_mudanca', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_requisition_history_req ON requisition_history (requisition_id)'],
    })
    app.save(collection)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('requisition_history'))
    } catch (_) {}
  },
)
