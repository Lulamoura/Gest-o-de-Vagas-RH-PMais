migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('candidate_email_log')
    if (!col.fields.getByName('error_message')) {
      col.fields.add(new TextField({ name: 'error_message' }))
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('candidate_email_log')
    const field = col.fields.getByName('error_message')
    if (field) {
      col.fields.remove(field)
    }
    app.save(col)
  },
)
