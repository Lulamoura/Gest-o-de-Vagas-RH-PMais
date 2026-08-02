migrate(
  (app) => {
    var requisitionsId = app.findCollectionByNameOrId('requisitions').id
    var usersId = '_pb_users_auth_'

    var collection = new Collection({
      name: 'requisition_comments',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: '@request.auth.id = usuario_id',
      deleteRule:
        "@request.auth.id = usuario_id || @request.auth.profile = 'admin' || @request.auth.profile = 'superadmin'",
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
          required: true,
        },
        { name: 'comentario', type: 'text', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_requisition_comments_req ON requisition_comments (requisition_id)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('requisition_comments'))
    } catch (_) {}
  },
)
