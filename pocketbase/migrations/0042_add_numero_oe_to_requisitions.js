migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('requisitions')
    if (!col.fields.getByName('numero_oe')) {
      col.fields.add(new TextField({ name: 'numero_oe' }))
    }
    col.addIndex('idx_requisitions_numero_oe', false, 'numero_oe', '')
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('requisitions')
    const field = col.fields.getByName('numero_oe')
    if (field) {
      col.fields.remove(field)
    }
    col.removeIndex('idx_requisitions_numero_oe')
    app.save(col)
  },
)
