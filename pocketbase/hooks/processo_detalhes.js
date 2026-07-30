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
    if (formattedCNJ && cnjCandidates.indexOf(formattedCNJ) < 0) cnjCandidates.push(formattedCNJ)
    if (digitsOnly && cnjCandidates.indexOf(digitsOnly) < 0) cnjCandidates.push(digitsOnly)
    if (cleanNumero && cnjCandidates.indexOf(cleanNumero) < 0) cnjCandidates.push(cleanNumero)

    $app
      .logger()
      .info(
        'Iniciando busca de detalhes de processo',
        'cleanNumero',
        cleanNumero,
        'digitsOnly',
        digitsOnly,
        'formattedCNJ',
        formattedCNJ,
      )

    let localMatch = null
    try {
      const records = $app.findRecordsByFilter(
        'candidato_consultas_juridicas',
        "id != ''",
        '-created',
        500,
        0,
      )

      function checkProcMatch(proc) {
        if (!proc || typeof proc !== 'object') return false
        const candList = [
          proc.numero_cnj,
          proc.numero,
          proc.numero_processo,
          proc.titulo,
          proc.id,
          proc.capa && proc.capa.numero,
          proc.capa && proc.capa.numero_cnj,
          proc.resposta && proc.resposta.numero_cnj,
          proc.resposta && proc.resposta.numero,
        ]

        if (Array.isArray(proc.fontes)) {
          for (let f = 0; f < proc.fontes.length; f++) {
            const fonte = proc.fontes[f]
            if (!fonte) continue
            if (fonte.numero_processo) candList.push(fonte.numero_processo)
            if (fonte.numero) candList.push(fonte.numero)
            if (fonte.capa && fonte.capa.numero) candList.push(fonte.capa.numero)
            if (fonte.capa && fonte.capa.numero_cnj) candList.push(fonte.capa.numero_cnj)
          }
        }

        for (let c = 0; c < candList.length; c++) {
          if (!candList[c]) continue
          const candStr = String(candList[c]).trim()
          const candDigits = candStr.replace(/\D/g, '')

          if (digitsOnly && candDigits && digitsOnly === candDigits) return true
          if (candStr === formattedCNJ || candStr === cleanNumero) return true
        }
        return false
      }

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
          if (checkProcMatch(proc)) {
            localMatch = proc
            break
          }
        }
        if (localMatch) break
      }
    } catch (errDb) {
      $app.logger().error('Erro ao buscar processo no banco local', 'error', String(errDb))
    }

    const token = $secrets.get('ESCAVADOR_API_TOKEN')
    let apiErrorMsg = ''

    if (token) {
      const baseUrl = 'https://api.escavador.com'
      const endpointsToTry = []

      for (let i = 0; i < cnjCandidates.length; i++) {
        const cnj = cnjCandidates[i]
        endpointsToTry.push(baseUrl + '/api/v2/processos/numero-cnj/' + encodeURIComponent(cnj))
        endpointsToTry.push(baseUrl + '/api/v2/processos/numero/' + encodeURIComponent(cnj))
        endpointsToTry.push(baseUrl + '/api/v2/processos?q=' + encodeURIComponent(cnj))
        endpointsToTry.push(baseUrl + '/api/v2/processos?numero_cnj=' + encodeURIComponent(cnj))
      }

      for (let j = 0; j < endpointsToTry.length; j++) {
        const url = endpointsToTry[j]
        try {
          $app.logger().info('Consultando API Escavador v2', 'url', url)
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
            apiErrorMsg = 'Erro de autenticação na API Escavador (HTTP ' + procRes.statusCode + ')'
            break
          }

          if (procRes.statusCode === 429) {
            apiErrorMsg = 'Limite de consultas excedido na API Escavador'
            if (localMatch) return e.json(200, localMatch)
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
                if (procData.length > 0) {
                  let bestMatch = procData[0]
                  for (let k = 0; k < procData.length; k++) {
                    const item = procData[k]
                    const itemCnj =
                      item.numero_cnj || item.numero || (item.capa && item.capa.numero) || ''
                    if (itemCnj && String(itemCnj).replace(/\D/g, '') === digitsOnly) {
                      bestMatch = item
                      break
                    }
                  }
                  return e.json(200, bestMatch)
                }
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
                procData.fontes ||
                procData.partes ||
                procData.movimentacoes
              ) {
                return e.json(200, procData)
              }
            }
          } else if (procRes.statusCode === 404) {
            apiErrorMsg = 'API returned 404 (Processo não encontrado)'
          }
        } catch (err) {
          apiErrorMsg = 'Exceção de conexão: ' + String(err)
          $app.logger().error('Exceção ao chamar API Escavador', 'url', url, 'error', String(err))
        }
      }
    }

    if (localMatch) {
      $app.logger().info('Retornando processo encontrado no banco local', 'cnj', formattedCNJ)
      return e.json(200, localMatch)
    }

    try {
      const records = $app.findRecordsByFilter(
        'candidato_consultas_juridicas',
        "id != ''",
        '-created',
        1,
        0,
      )
      if (records.length > 0) {
        const lastRec = records[0]
        const currErro = lastRec.getString('erro') || ''
        const newReason =
          'Processo ' + formattedCNJ + ' não encontrado (' + (apiErrorMsg || '404') + ')'
        if (currErro.indexOf(newReason) < 0) {
          lastRec.set('erro', currErro ? currErro + ' | ' + newReason : newReason)
          $app.saveNoValidate(lastRec)
        }
      }
    } catch (_) {}

    if (!token) {
      return e.json(503, { error: 'Token da API Escavador não configurado. Contate o suporte.' })
    }

    return e.json(404, { error: 'Processo não encontrado na base do Escavador.' })
  },
  $apis.requireAuth(),
)
