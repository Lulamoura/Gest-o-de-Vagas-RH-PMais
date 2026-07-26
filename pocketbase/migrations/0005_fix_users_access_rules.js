migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    usersCol.listRule = "@request.auth.profile = 'admin' || id = @request.auth.id"
    usersCol.viewRule = "@request.auth.profile = 'admin' || id = @request.auth.id"
    usersCol.createRule = "@request.auth.profile = 'admin'"
    usersCol.updateRule = "@request.auth.profile = 'admin' || id = @request.auth.id"
    usersCol.deleteRule = "@request.auth.profile = 'admin'"
    app.save(usersCol)
  },
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    usersCol.listRule = 'id = @request.auth.id'
    usersCol.viewRule = 'id = @request.auth.id'
    usersCol.createRule = ''
    usersCol.updateRule = 'id = @request.auth.id'
    usersCol.deleteRule = 'id = @request.auth.id'
    app.save(usersCol)
  },
)
