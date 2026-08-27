routerAdd(
  'GET',
  '/backend/v1/agent/laika/conversations',
  (e) => {
    try {
      var userId = e.auth ? e.auth.id : null
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      var query = e.requestInfo().query || {}
      var limit = parseInt(query.limit || '20', 10) || 20

      var conversations = $ai.agent('laika').listConversations({
        user_id: userId,
        limit: limit,
      })

      return e.json(200, { items: conversations })
    } catch (err) {
      var status = 500
      var msg = 'Erro ao listar conversas'
      if (err && err.status) status = err.status
      if (err && err.message && status < 500) msg = err.message
      return e.json(status, { error: msg })
    }
  },
  $apis.requireAuth(),
)
