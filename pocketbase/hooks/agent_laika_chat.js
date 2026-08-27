routerAdd(
  'POST',
  '/backend/v1/agent/laika/chat',
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

      var result = $ai.agent('laika').chat({
        user_id: userId,
        conversation_id: body.conversation_id || null,
        message: message,
      })

      return e.json(200, {
        conversation_id: result.conversation_id,
        content: result.content,
        citations: result.citations,
        message_id: result.message_id,
      })
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
