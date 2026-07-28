migrate(
  (app) => {
    var vacanciesColId = app.findCollectionByNameOrId('vacancies').id
    var candidatesColId = app.findCollectionByNameOrId('candidates').id

    var collection = new Collection({
      name: 'candidate_history',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'vacancy_id',
          type: 'relation',
          collectionId: vacanciesColId,
          maxSelect: 1,
          cascadeDelete: true,
          required: true,
        },
        {
          name: 'candidate_id',
          type: 'relation',
          collectionId: candidatesColId,
          maxSelect: 1,
          cascadeDelete: true,
          required: true,
        },
        {
          name: 'usuario_id',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'status_anterior', type: 'text' },
        { name: 'status_novo', type: 'text', required: true },
        { name: 'data_mudanca', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_candidate_history_vacancy ON candidate_history (vacancy_id)'],
    })
    app.save(collection)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('candidate_history'))
    } catch (_) {}
  },
)
