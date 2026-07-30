routerAdd(
  'GET',
  '/backend/v1/processo/{numeroProcesso}',
  (e) => {
    const numeroProcesso = e.request.pathValue('numeroProcesso')
    if (!numeroProcesso || !numeroProcesso.trim()) {
      return e.badRequestError('Número do processo é obrigatório')
    }

    const userId = e.auth ? e.auth.id : ''
    if (!userId) return e.unauthorizedError('Autenticação necessária')

    const userProfile = e.auth ? e.auth.getString('profile') : ''
    if (userProfile !== 'admin' && userProfile !== 'superadmin') {
      return e.forbiddenError('Apenas administradores podem visualizar detalhes de processos')
    }

    const cleanNumero = numeroProcesso.trim()

    const token = $secrets.get('ESCAVADOR_API_TOKEN')
    if (!token) {
      return e.json(503, { error: 'Token da API Escavador não configurado. Contate o suporte.' })
    }

    const baseUrl = 'https://api.escavador.com'

    try {
      const procRes = $http.send({
        url: baseUrl + '/api/v2/processo/' + encodeURIComponent(cleanNumero),
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        timeout: 30,
      })

      if (procRes.statusCode === 404) {
        return e.json(404, { error: 'Processo não encontrado na base do Escavador.' })
      }

      if (procRes.statusCode === 429) {
        return e.json(429, {
          error:
            'Limite de consultas excedido na API Escavador. Tente novamente em alguns minutos.',
        })
      }

      if (procRes.statusCode === 401 || procRes.statusCode === 403) {
        return e.json(503, {
          error: 'Token da API Escavador inválido ou expirado. Contate o suporte.',
        })
      }

      if (procRes.statusCode < 200 || procRes.statusCode >= 300) {
        return e.json(procRes.statusCode, {
          error: 'Erro ao consultar API Escavador (HTTP ' + procRes.statusCode + ').',
        })
      }

      var procData = procRes.json || {}
      if (!procData || (typeof procData === 'object' && Object.keys(procData).length === 0)) {
        return e.json(404, { error: 'Nenhum dado retornado para este processo.' })
      }

      return e.json(200, procData)
    } catch (err) {
      $app
        .logger()
        .error('Erro ao buscar detalhes do processo', 'error', String(err), 'processo', cleanNumero)
      return e.json(500, { error: 'Erro ao conectar com a API Escavador. Tente novamente.' })
    }
  },
  $apis.requireAuth(),
)
