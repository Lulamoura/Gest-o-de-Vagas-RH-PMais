migrate(
  (app) => {
    var requisitionsId = app.findCollectionByNameOrId('requisitions').id
    var usersId = '_pb_users_auth_'

    var collection = new Collection({
      name: 'requisition_attachments',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule:
        "@request.auth.id = uploaded_by || @request.auth.profile = 'admin' || @request.auth.profile = 'superadmin'",
      deleteRule:
        "@request.auth.id = uploaded_by || @request.auth.profile = 'admin' || @request.auth.profile = 'superadmin'",
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
          name: 'uploaded_by',
          type: 'relation',
          collectionId: usersId,
          maxSelect: 1,
          cascadeDelete: false,
          required: true,
        },
        {
          name: 'arquivo',
          type: 'file',
          maxSelect: 1,
          maxSize: 10485760,
          required: true,
          mimeTypes: [
            'image/jpeg',
            'image/png',
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
          ],
        },
        { name: 'nome_arquivo', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_requisition_attachments_req ON requisition_attachments (requisition_id)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('requisition_attachments'))
    } catch (_) {}
  },
)
