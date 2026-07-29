migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('candidates')
    if (!col.fields.getByName('observacao')) {
      col.fields.add(new TextField({ name: 'observacao' }))
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('candidates')
    const field = col.fields.getByName('observacao')
    if (field) {
      col.fields.remove(field)
      app.save(col)
    }
  },
)
