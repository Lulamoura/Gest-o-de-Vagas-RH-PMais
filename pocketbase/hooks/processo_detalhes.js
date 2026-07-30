routerAdd(
  'GET',
  '/backend/v1/processo/{processoId}',
  (e) => {
    const processoId = e.request.pathValue('processoId')
    if (!processoId || !processoId.trim()) {
      return e.badRequestError('ID do processo é obrigatório')
    }

    const userId = e.auth ? e.auth.id : ''
    if (!userId) return e.unauthorizedError('Autenticação necessária')

    const userProfile = e.auth ? e.auth.getString('profile') : ''
    if (userProfile !== 'admin' && userProfile !== 'superadmin') {
      return e.forbiddenError('Apenas administradores podem visualizar detalhes de processos')
    }

    const cleanId = processoId.trim()

    const token = $secrets.get('ESCAVADOR_API_TOKEN')
    if (!token) {
      return e.json(503, { error: 'Token da API Escavador não configurado. Contate o suporte.' })
    }

    const url = 'https://api.escavador.com/api/v2/processos/' + encodeURIComponent(cleanId)

    $app.logger().info('Buscando detalhes do processo por ID', 'id', cleanId, 'url', url)

    try {
      const procRes = $http.send({
        url: url,
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + token,
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        timeout: 25,
      })

      if (procRes.statusCode === 401 || procRes.statusCode === 403) {
        $app
          .logger()
          .error('Erro de autenticação na API Escavador', 'statusCode', procRes.statusCode)
        return e.json(401, { error: 'Erro de autenticação na API Escavador' })
      }

      if (procRes.statusCode === 429) {
        return e.json(429, {
          error:
            'Limite de consultas excedido na API Escavador. Tente novamente em alguns minutos.',
        })
      }

      if (procRes.statusCode === 404) {
        return e.json(404, { error: 'Processo não encontrado na base do Escavador.' })
      }

      if (procRes.statusCode < 200 || procRes.statusCode >= 300) {
        $app
          .logger()
          .error('Erro ao buscar processo na API Escavador', 'statusCode', procRes.statusCode)
        return e.json(502, { error: 'Não foi possível carregar os detalhes do processo' })
      }

      let procData = procRes.json || {}
      if (procData.resposta && typeof procData.resposta === 'object') {
        procData = procData.resposta
      } else if (procData.data && typeof procData.data === 'object') {
        procData = procData.data
      }

      if (!procData || typeof procData !== 'object' || Object.keys(procData).length === 0) {
        return e.json(404, { error: 'Não foi possível carregar os detalhes do processo' })
      }

      return e.json(200, procData)
    } catch (err) {
      $app
        .logger()
        .error('Erro ao buscar detalhes do processo', 'id', cleanId, 'error', String(err))
      return e.json(500, { error: 'Não foi possível carregar os detalhes do processo' })
    }
  },
  $apis.requireAuth(),
)
