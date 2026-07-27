migrate(
  (app) => {
    const candidatesCol = app.findCollectionByNameOrId('candidates')
    if (!candidatesCol.fields.getByName('cpf')) {
      candidatesCol.fields.add(
        new TextField({
          name: 'cpf',
        }),
      )
      app.save(candidatesCol)
    }
  },
  (app) => {
    const candidatesCol = app.findCollectionByNameOrId('candidates')
    const cpfField = candidatesCol.fields.getByName('cpf')
    if (cpfField) {
      candidatesCol.fields.remove(cpfField)
      app.save(candidatesCol)
    }
  },
)
