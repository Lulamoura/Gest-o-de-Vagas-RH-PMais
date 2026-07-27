migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    usersCol.fields.removeByName('profile')
    usersCol.fields.add(
      new SelectField({
        name: 'profile',
        values: ['admin', 'operator', 'viewer', 'superadmin'],
        maxSelect: 1,
      }),
    )

    usersCol.listRule =
      "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin' || id = @request.auth.id"
    usersCol.viewRule =
      "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin' || id = @request.auth.id"
    usersCol.createRule = "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin'"
    usersCol.updateRule =
      "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin' || id = @request.auth.id"
    usersCol.deleteRule = "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin'"

    app.save(usersCol)

    const vacanciesCol = app.findCollectionByNameOrId('vacancies')
    vacanciesCol.updateRule =
      "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin'"
    vacanciesCol.deleteRule = "@request.auth.profile = 'superadmin'"
    app.save(vacanciesCol)

    try {
      const user = app.findAuthRecordByEmail('_pb_users_auth_', 'luiz.moura@pmaisservicos.com.br')
      if (user.getString('profile') !== 'superadmin') {
        user.set('profile', 'superadmin')
        app.save(user)
      }
    } catch (_) {}
  },
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    usersCol.fields.removeByName('profile')
    usersCol.fields.add(
      new SelectField({
        name: 'profile',
        values: ['admin', 'operator', 'viewer'],
        maxSelect: 1,
      }),
    )

    usersCol.listRule = "@request.auth.profile = 'admin' || id = @request.auth.id"
    usersCol.viewRule = "@request.auth.profile = 'admin' || id = @request.auth.id"
    usersCol.createRule = "@request.auth.profile = 'admin'"
    usersCol.updateRule = "@request.auth.profile = 'admin' || id = @request.auth.id"
    usersCol.deleteRule = "@request.auth.profile = 'admin'"
    app.save(usersCol)

    const vacanciesCol = app.findCollectionByNameOrId('vacancies')
    vacanciesCol.updateRule = "@request.auth.id != ''"
    vacanciesCol.deleteRule = "@request.auth.id != ''"
    app.save(vacanciesCol)

    try {
      const user = app.findAuthRecordByEmail('_pb_users_auth_', 'luiz.moura@pmaisservicos.com.br')
      if (user.getString('profile') === 'superadmin') {
        user.set('profile', 'admin')
        app.save(user)
      }
    } catch (_) {}
  },
)
