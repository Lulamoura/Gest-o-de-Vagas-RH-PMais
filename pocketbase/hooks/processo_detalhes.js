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
    const digitsOnly = cleanNumero.replace(/\D/g, '')

    let formattedCNJ = cleanNumero
    if (digitsOnly.length === 20) {
      formattedCNJ = digitsOnly.replace(
        /^(\d{7})(\d{2})(\d{4})(\d{1})(\d{2})(\d{4})$/,
        '$1-$2.$3.$4.$5.$6',
      )
    }

    const cnjCandidates = []
    if (formattedCNJ) cnjCandidates.push(formattedCNJ)
    if (digitsOnly && digitsOnly !== formattedCNJ) cnjCandidates.push(digitsOnly)
    if (cleanNumero && !cnjCandidates.includes(cleanNumero)) cnjCandidates.push(cleanNumero)

    const token = $secrets.get('ESCAVADOR_API_TOKEN')
    if (!token) {
      return e.json(503, { error: 'Token da API Escavador não configurado. Contate o suporte.' })
    }

    const baseUrl = 'https://api.escavador.com'
    const endpointPrefixes = [
      '/api/v2/processos/numero/',
      '/api/v2/processos/',
      '/api/v2/processo/',
    ]

    let lastErrorStatus = 404
    let lastErrorMessage = 'Processo não encontrado na base do Escavador.'

    for (let i = 0; i < cnjCandidates.length; i++) {
      const cnj = cnjCandidates[i]
      for (let j = 0; j < endpointPrefixes.length; j++) {
        const prefix = endpointPrefixes[j]
        const url = baseUrl + prefix + encodeURIComponent(cnj)

        try {
          const procRes = $http.send({
            url: url,
            method: 'GET',
            headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
            timeout: 30,
          })

          if (procRes.statusCode === 401 || procRes.statusCode === 403) {
            return e.json(503, {
              error: 'Token da API Escavador inválido ou expirado. Contate o suporte.',
            })
          }

          if (procRes.statusCode === 429) {
            return e.json(429, {
              error:
                'Limite de consultas excedido na API Escavador. Tente novamente em alguns minutos.',
            })
          }

          if (procRes.statusCode >= 200 && procRes.statusCode < 300) {
            let procData = procRes.json || {}
            if (procData.resposta && typeof procData.resposta === 'object') {
              procData = procData.resposta
            } else if (procData.data && typeof procData.data === 'object') {
              procData = procData.data
            }

            if (procData && typeof procData === 'object' && Object.keys(procData).length > 0) {
              return e.json(200, procData)
            }
          }

          if (procRes.statusCode !== 404) {
            lastErrorStatus = procRes.statusCode
            if (procRes.json && procRes.json.mensagem) {
              lastErrorMessage = procRes.json.mensagem
            } else if (procRes.json && procRes.json.error) {
              lastErrorMessage = procRes.json.error
            }
          }
        } catch (err) {
          $app.logger().error('Erro ao buscar processo Escavador', 'url', url, 'error', String(err))
        }
      }
    }

    return e.json(lastErrorStatus, { error: lastErrorMessage })
  },
  $apis.requireAuth(),
)
