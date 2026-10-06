migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!usersCol.fields.getByName('ativo')) {
      usersCol.fields.add(
        new BoolField({
          name: 'ativo',
          required: false,
        }),
      )
      app.save(usersCol)
    }

    // No SQLite / PocketBase, BoolField não preenchido ou default pode ser 0 ou NULL
    // Todos os usuários existentes devem ser ativos (ativo = 1 / true)
    app.db().newQuery('UPDATE users SET ativo = 1').execute()
  },
  (app) => {
    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      if (usersCol.fields.getByName('ativo')) {
        usersCol.fields.removeByName('ativo')
        app.save(usersCol)
      }
    } catch (_) {}
  },
)
