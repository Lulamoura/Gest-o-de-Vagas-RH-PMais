migrate(
  (app) => {
    const candidatesCol = app.findCollectionByNameOrId('candidates')
    if (!candidatesCol.fields.getByName('rank')) {
      candidatesCol.fields.add(
        new NumberField({
          name: 'rank',
          min: 1,
          max: 5,
          onlyInt: true,
        }),
      )
      app.save(candidatesCol)
    }
  },
  (app) => {
    const candidatesCol = app.findCollectionByNameOrId('candidates')
    const rankField = candidatesCol.fields.getByName('rank')
    if (rankField) {
      candidatesCol.fields.remove(rankField)
      app.save(candidatesCol)
    }
  },
)
