routerAdd(
  'GET',
  '/backend/v1/processo/{numeroProcesso}',
  (e) => {
    const numeroParam = e.request.pathValue('numeroProcesso')
    if (!numeroParam || !numeroParam.trim()) {
      return e.badRequestError('Número do processo é obrigatório')
    }

    const userId = e.auth ? e.auth.id : ''
    if (!userId) return e.unauthorizedError('Autenticação necessária')

    const userProfile = e.auth ? e.auth.getString('profile') : ''
    if (userProfile !== 'admin' && userProfile !== 'superadmin') {
      return e.forbiddenError('Apenas administradores podem visualizar detalhes de processos')
    }

    let cleanNumero = numeroParam.trim()
    try {
      cleanNumero = decodeURIComponent(cleanNumero).trim()
    } catch (_) {}

    const digitsOnly = cleanNumero.replace(/\D/g, '')

    let formattedCNJ = cleanNumero
    if (digitsOnly.length === 20) {
      formattedCNJ = digitsOnly.replace(
        /^(\d{7})(\d{2})(\d{4})(\d{1})(\d{2})(\d{4})$/,
        '$1-$2.$3.$4.$5.$6',
      )
    }

    const cnjCandidates = []
    if (formattedCNJ && !cnjCandidates.includes(formattedCNJ)) cnjCandidates.push(formattedCNJ)
    if (digitsOnly && !cnjCandidates.includes(digitsOnly)) cnjCandidates.push(digitsOnly)
    if (cleanNumero && !cnjCandidates.includes(cleanNumero)) cnjCandidates.push(cleanNumero)

    const token = $secrets.get('ESCAVADOR_API_TOKEN')
    if (token) {
      const baseUrl = 'https://api.escavador.com'
      const endpointPrefixes = [
        '/api/v2/processos/numero-cnj/',
        '/api/v2/processos/numero/',
        '/api/v2/processos/',
        '/api/v2/processo/',
      ]

      for (let i = 0; i < cnjCandidates.length; i++) {
        const cnj = cnjCandidates[i]
        for (let j = 0; j < endpointPrefixes.length; j++) {
          const prefix = endpointPrefixes[j]
          const url = baseUrl + prefix + encodeURIComponent(cnj)

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
              break
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
                if (Array.isArray(procData)) {
                  if (procData.length > 0) return e.json(200, procData[0])
                } else if (
                  procData.items &&
                  Array.isArray(procData.items) &&
                  procData.items.length > 0
                ) {
                  return e.json(200, procData.items[0])
                } else if (
                  procData.numero_cnj ||
                  procData.numero ||
                  procData.capa ||
                  procData.id ||
                  procData.titulo ||
                  procData.fontes
                ) {
                  return e.json(200, procData)
                }
              }
            }
          } catch (err) {
            $app
              .logger()
              .error('Erro ao buscar processo Escavador', 'url', url, 'error', String(err))
          }
        }
      }

      for (let s = 0; s < cnjCandidates.length; s++) {
        const queryTerm = cnjCandidates[s]
        const searchUrl = baseUrl + '/api/v2/processos?q=' + encodeURIComponent(queryTerm)
        try {
          const searchRes = $http.send({
            url: searchUrl,
            method: 'GET',
            headers: {
              Authorization: 'Bearer ' + token,
              Accept: 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
            },
            timeout: 25,
          })

          if (searchRes.statusCode === 429) {
            return e.json(429, {
              error:
                'Limite de consultas excedido na API Escavador. Tente novamente em alguns minutos.',
            })
          }

          if (searchRes.statusCode >= 200 && searchRes.statusCode < 300) {
            let searchJson = searchRes.json || {}
            let items = []
            if (Array.isArray(searchJson.resposta)) {
              items = searchJson.resposta
            } else if (searchJson.resposta && Array.isArray(searchJson.resposta.items)) {
              items = searchJson.resposta.items
            } else if (searchJson.resposta && Array.isArray(searchJson.resposta.data)) {
              items = searchJson.resposta.data
            } else if (Array.isArray(searchJson.items)) {
              items = searchJson.items
            } else if (Array.isArray(searchJson.data)) {
              items = searchJson.data
            }

            if (items && items.length > 0) {
              let bestMatch = items[0]
              for (let k = 0; k < items.length; k++) {
                const item = items[k]
                const itemCnj =
                  item.numero_cnj ||
                  item.numero ||
                  item.numero_processo ||
                  (item.capa && item.capa.numero) ||
                  ''
                const itemDigits = String(itemCnj).replace(/\D/g, '')
                if (digitsOnly && itemDigits === digitsOnly) {
                  bestMatch = item
                  break
                }
              }
              return e.json(200, bestMatch)
            }
          }
        } catch (errSearch) {
          $app
            .logger()
            .error(
              'Erro na busca de processos Escavador',
              'url',
              searchUrl,
              'error',
              String(errSearch),
            )
        }
      }
    }

    try {
      const records = $app.findRecordsByFilter(
        'candidato_consultas_juridicas',
        "status_consulta = 'sucesso'",
        '-created',
        100,
        0,
      )

      for (let r = 0; r < records.length; r++) {
        const rec = records[r]
        const processosJson = rec.get('processos_json')

        let procList = []
        if (Array.isArray(processosJson)) {
          procList = processosJson
        } else if (processosJson && typeof processosJson === 'object') {
          if (Array.isArray(processosJson.items)) procList = processosJson.items
          else if (Array.isArray(processosJson.data)) procList = processosJson.data
          else if (Array.isArray(processosJson.resposta)) procList = processosJson.resposta
          else procList = [processosJson]
        }

        for (let p = 0; p < procList.length; p++) {
          const proc = procList[p]
          if (!proc || typeof proc !== 'object') continue

          const pCnj =
            proc.numero_cnj ||
            proc.numero ||
            proc.numero_processo ||
            proc.titulo ||
            (proc.capa && proc.capa.numero) ||
            (proc.resposta && proc.resposta.numero_cnj) ||
            ''
          const pDigits = String(pCnj).replace(/\D/g, '')

          if (
            (pCnj && (pCnj === cleanNumero || pCnj === formattedCNJ)) ||
            (digitsOnly &&
              pDigits &&
              (pDigits === digitsOnly ||
                digitsOnly.includes(pDigits) ||
                pDigits.includes(digitsOnly)))
          ) {
            return e.json(200, proc)
          }
        }
      }
    } catch (errDb) {
      $app.logger().error('Erro ao buscar processo no banco local', 'error', String(errDb))
    }

    if (!token) {
      return e.json(503, { error: 'Token da API Escavador não configurado. Contate o suporte.' })
    }

    return e.json(404, { error: 'Processo não encontrado na base do Escavador.' })
  },
  $apis.requireAuth(),
)
