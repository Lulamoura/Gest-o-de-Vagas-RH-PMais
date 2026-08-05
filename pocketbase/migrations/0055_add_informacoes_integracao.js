migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('candidates')
    if (!col.fields.getByName('informacoes_integracao')) {
      col.fields.add(new TextField({ name: 'informacoes_integracao' }))
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('candidates')
    const field = col.fields.getByName('informacoes_integracao')
    if (field) {
      col.fields.remove(field)
      app.save(col)
    }
  },
)
