migrate(
  (app) => {
    const usersColId = '_pb_users_auth_'
    const candidatesColId = app.findCollectionByNameOrId('candidates').id

    const collection = new Collection({
      name: 'candidate_email_log',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin'",
      fields: [
        {
          name: 'candidate_id',
          type: 'relation',
          required: true,
          collectionId: candidatesColId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'email_type',
          type: 'select',
          required: true,
          values: ['complement_data', 'disqualification'],
          maxSelect: 1,
        },
        {
          name: 'sent_by',
          type: 'relation',
          required: false,
          collectionId: usersColId,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_candidate_email_log_candidate ON candidate_email_log (candidate_id)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('candidate_email_log')
    app.delete(collection)
  },
)
