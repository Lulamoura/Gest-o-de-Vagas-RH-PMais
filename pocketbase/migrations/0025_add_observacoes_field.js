migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('candidates')
    if (!col.fields.getByName('observacoes')) {
      col.fields.add(new TextField({ name: 'observacoes' }))
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('candidates')
    const field = col.fields.getByName('observacoes')
    if (field) {
      col.fields.removeByName('observacoes')
    }
    app.save(col)
  },
)
