migrate(
  (app) => {
    const candidatesCol = app.findCollectionByNameOrId('candidates')
    if (!candidatesCol.fields.getByName('wordpress_candidatura_id')) {
      candidatesCol.fields.add(
        new TextField({
          name: 'wordpress_candidatura_id',
        }),
      )
      app.save(candidatesCol)
    }
  },
  (app) => {
    const candidatesCol = app.findCollectionByNameOrId('candidates')
    const field = candidatesCol.fields.getByName('wordpress_candidatura_id')
    if (field) {
      candidatesCol.fields.remove(field)
      app.save(candidatesCol)
    }
  },
)
