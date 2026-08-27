routerAdd(
  'GET',
  '/backend/v1/agent/laika/conversations/{conversationId}/messages',
  (e) => {
    try {
      var userId = e.auth ? e.auth.id : null
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      var conversationId = e.request.pathValue('conversationId')
      if (!conversationId) return e.badRequestError('ID da conversa é obrigatório')

      var query = e.requestInfo().query || {}
      var limit = parseInt(query.limit || '50', 10) || 50

      var messages = $ai.agent('laika').listMessages({
        conversation_id: conversationId,
        user_id: userId,
        limit: limit,
      })

      return e.json(200, { messages: messages })
    } catch (err) {
      var status = 500
      var msg = 'Erro ao buscar mensagens'
      if (err && err.status) status = err.status
      if (err && err.message && status < 500) msg = err.message
      return e.json(status, { error: msg })
    }
  },
  $apis.requireAuth(),
)
