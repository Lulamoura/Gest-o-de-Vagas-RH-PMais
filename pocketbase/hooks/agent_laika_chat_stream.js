routerAdd(
  'POST',
  '/backend/v1/agent/laika/chat-stream',
  (e) => {
    try {
      var userId = e.auth ? e.auth.id : null
      if (!userId) return e.unauthorizedError('Autenticação necessária')

      var body = e.requestInfo().body || {}
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body)
        } catch (_) {
          body = {}
        }
      }

      var message = (body.message || '').toString().trim()
      if (!message) return e.badRequestError('Mensagem é obrigatória')

      var conv = $ai.agent('laika').getOrCreateConversation({
        user_id: userId,
        id: body.conversation_id || null,
      })

      var iter = $ai.agent('laika').chat({
        user_id: userId,
        conversation_id: conv.id,
        message: message,
        stream: true,
      })

      e.response.header().set('Content-Type', 'text/event-stream')
      e.response.header().set('Cache-Control', 'no-cache')
      e.response.header().set('X-Conversation-Id', conv.id)
      $response.stream(e, iter)
    } catch (err) {
      var status = 500
      var msg = 'Erro ao processar mensagem do assistente'
      if (err && err.status) status = err.status
      if (err && err.message) {
        if (status < 500) msg = err.message
      }
      return e.json(status, { error: msg })
    }
  },
  $apis.requireAuth(),
)
