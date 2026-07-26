migrate(
  (app) => {
    var users = app.findCollectionByNameOrId('_pb_users_auth_')

    try {
      app.findFirstRecordByData('users', 'name', 'PMais - Web')
    } catch (_) {
      var user = new Record(users)
      user.setEmail('pmais.web@pmaisservicos.com.br')
      user.setPassword('Skip@Pass')
      user.setVerified(true)
      user.set('name', 'PMais - Web')
      user.set('profile', 'operator')
      app.save(user)
      console.log('WordPress integration: created PMais - Web user')
    }

    try {
      app.findFirstRecordByData('clientes', 'nome', 'PMais')
    } catch (_) {
      var clientesCol = app.findCollectionByNameOrId('clientes')
      var cliente = new Record(clientesCol)
      cliente.set('nome', 'PMais')
      app.save(cliente)
      console.log('WordPress integration: created PMais cliente')
    }
  },
  (app) => {
    try {
      var user = app.findFirstRecordByData('users', 'name', 'PMais - Web')
      app.delete(user)
    } catch (_) {}
    try {
      var cliente = app.findFirstRecordByData('clientes', 'nome', 'PMais')
      app.delete(cliente)
    } catch (_) {}
  },
)
