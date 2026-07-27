migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('vacancies')
    const desiredRule = "@request.auth.profile = 'superadmin'"
    if (col.deleteRule !== desiredRule) {
      col.deleteRule = desiredRule
      app.save(col)
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('vacancies')
    col.deleteRule = "@request.auth.id != ''"
    app.save(col)
  },
)
