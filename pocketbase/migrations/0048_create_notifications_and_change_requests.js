migrate(
  (app) => {
    var usersId = '_pb_users_auth_'
    var requisitionsId = app.findCollectionByNameOrId('requisitions').id

    var notifications = new Collection({
      name: 'notifications',
      type: 'base',
      listRule: '@request.auth.id = user',
      viewRule: '@request.auth.id = user',
      createRule: null,
      updateRule: '@request.auth.id = user',
      deleteRule: '@request.auth.id = user',
      fields: [
        {
          name: 'user',
          type: 'relation',
          collectionId: usersId,
          maxSelect: 1,
          cascadeDelete: true,
          required: true,
        },
        {
          name: 'requisition',
          type: 'relation',
          collectionId: requisitionsId,
          maxSelect: 1,
          cascadeDelete: true,
          required: true,
        },
        {
          name: 'type',
          type: 'select',
          values: [
            'requisition_submitted',
            'requisition_approved',
            'requisition_reproved',
            'new_comment',
            'change_request_submitted',
            'change_request_approved',
            'change_request_reproved',
          ],
          maxSelect: 1,
          required: true,
        },
        { name: 'message', type: 'text', required: true },
        { name: 'read', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_notifications_user ON notifications (user)',
        'CREATE INDEX idx_notifications_read ON notifications (read)',
        'CREATE INDEX idx_notifications_created ON notifications (created DESC)',
      ],
    })
    app.save(notifications)

    var changeRequests = new Collection({
      name: 'requisition_change_requests',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin'",
      deleteRule: "@request.auth.profile = 'superadmin'",
      fields: [
        {
          name: 'requisition',
          type: 'relation',
          collectionId: requisitionsId,
          maxSelect: 1,
          cascadeDelete: true,
          required: true,
        },
        {
          name: 'solicitante',
          type: 'relation',
          collectionId: usersId,
          maxSelect: 1,
          cascadeDelete: false,
          required: true,
        },
        { name: 'campos_alterados', type: 'text', required: true },
        { name: 'valores_propostos', type: 'text', required: true },
        { name: 'justificativa', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          values: ['Pendente', 'Aprovada', 'Reprovada'],
          maxSelect: 1,
        },
        { name: 'decisao_comentario', type: 'text' },
        {
          name: 'decidido_por',
          type: 'relation',
          collectionId: usersId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'decidido_em', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_change_requests_requisition ON requisition_change_requests (requisition)',
        'CREATE INDEX idx_change_requests_status ON requisition_change_requests (status)',
        'CREATE INDEX idx_change_requests_created ON requisition_change_requests (created DESC)',
      ],
    })
    app.save(changeRequests)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('notifications'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('requisition_change_requests'))
    } catch (_) {}
  },
)
