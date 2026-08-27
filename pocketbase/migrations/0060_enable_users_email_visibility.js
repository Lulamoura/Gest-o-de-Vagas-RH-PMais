migrate(
  (app) => {
    app.db().newQuery('UPDATE users SET emailVisibility = true').execute()
  },
  (app) => {
    app.db().newQuery('UPDATE users SET emailVisibility = false').execute()
  },
)
