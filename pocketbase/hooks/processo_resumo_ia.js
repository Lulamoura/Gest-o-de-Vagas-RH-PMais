routerAdd(
  'POST',
  '/backend/v1/processo/resumo-ia',
  (e) => {
    const body = e.requestInfo().body || {}
    const numeroProcesso = (body.numero_processo || '').trim()
    const consultaId = (body.consulta_id || '').trim()

    if (!numeroProcesso) return e.badRequestError('numero_processo é obrigatório')

    var userId = e.auth ? e.auth.id : ''
    if (!userId) return e.unauthorizedError('Autenticação necessária')

    var userProfile = e.auth ? e.auth.getString('profile') : ''
    if (userProfile !== 'admin' && userProfile !== 'superadmin') {
      return e.forbiddenError('Apenas administradores podem gerar resumos com IA')
    }

    if (consultaId) {
      try {
        var cacheRecord = $app.findRecordById('candidato_consultas_juridicas', consultaId)
        var cachedResumo = cacheRecord.get('resumo_json')
        if (cachedResumo && typeof cachedResumo === 'object') {
          var processoResumos = cachedResumo.processo_resumos || {}
          if (processoResumos[numeroProcesso]) {
            return e.json(200, { summary: processoResumos[numeroProcesso], cached: true })
          }
        }
      } catch (_) {}
    }

    var processData = null

    if (consultaId) {
      try {
        var dataRecord = $app.findRecordById('candidato_consultas_juridicas', consultaId)
        var processos = dataRecord.get('processos_json') || []
        if (Array.isArray(processos)) {
          for (var i = 0; i < processos.length; i++) {
            var proc = processos[i]
            var num = proc.numero_cnj || proc.numero || proc.numero_processo || proc.titulo || ''
            if (num && num === numeroProcesso) {
              processData = proc
              break
            }
          }
        }
      } catch (_) {}
    }

    var token = $secrets.get('ESCAVADOR_API_TOKEN')
    if (token) {
      try {
        var escavadorRes = $http.send({
          url: 'https://api.escavador.com/api/v2/processo/' + encodeURIComponent(numeroProcesso),
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
          timeout: 30,
        })
        if (escavadorRes.statusCode >= 200 && escavadorRes.statusCode < 300 && escavadorRes.json) {
          if (!processData) {
            processData = escavadorRes.json
          } else {
            processData._detalhes = escavadorRes.json
          }
        }
      } catch (_) {}
    }

    if (!processData) {
      processData = { numero_processo: numeroProcesso, info: 'Sem dados detalhados disponíveis.' }
    }

    var processInfo = JSON.stringify(processData)
    if (processInfo.length > 8000) {
      processInfo = processInfo.substring(0, 8000)
    }

    var summary = ''
    try {
      var reply = $ai.chat({
        model: 'fast',
        messages: [
          {
            role: 'system',
            content:
              'Você é um assistente jurídico especializado em análise de processos judiciais brasileiros. Gere um resumo claro e conciso do processo fornecido, explicando em linguagem simples e acessível para um profissional de Recursos Humanos: o tipo de ação, as partes envolvidas (polo ativo e passivo), o tribunal, o status atual e os principais pontos de atenção. O resumo deve ter no máximo 3 parágrafos curtos, ser objetivo e fácil de entender. Responda sempre em português do Brasil.',
          },
          {
            role: 'user',
            content: 'Analise e resuma este processo judicial (dados em JSON):\n\n' + processInfo,
          },
        ],
      })
      summary = reply.choices[0].message.content
    } catch (err) {
      return e.json(500, {
        error: 'Não foi possível gerar o resumo. Tente novamente mais tarde.',
      })
    }

    if (!summary || !summary.trim()) {
      return e.json(500, {
        error: 'Não foi possível obter o resumo. Tente novamente mais tarde.',
      })
    }

    if (consultaId) {
      try {
        var saveRecord = $app.findRecordById('candidato_consultas_juridicas', consultaId)
        var rj = saveRecord.get('resumo_json')
        if (typeof rj === 'string') {
          try {
            rj = JSON.parse(rj)
          } catch (_) {
            rj = {}
          }
        }
        if (!rj || typeof rj !== 'object') rj = {}
        if (!rj.processo_resumos) rj.processo_resumos = {}
        rj.processo_resumos[numeroProcesso] = summary
        saveRecord.set('resumo_json', rj)
        $app.saveNoValidate(saveRecord)
      } catch (_) {}
    }

    return e.json(200, { summary: summary, cached: false })
  },
  $apis.requireAuth(),
)
