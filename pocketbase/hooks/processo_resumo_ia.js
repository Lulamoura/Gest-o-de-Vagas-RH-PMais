routerAdd(
  'POST',
  '/backend/v1/processo/resumo-ia',
  (e) => {
    const body = e.requestInfo().body || {}
    const numeroProcesso = String(
      body.numero_processo || body.numeroProcesso || body.processo || '',
    ).trim()
    const consultaId = String(body.consulta_id || body.consultaId || '').trim()

    if (!numeroProcesso || !consultaId) {
      return e.badRequestError('numero_processo e consulta_id são obrigatórios')
    }

    let consulta
    try {
      consulta = $app.findRecordById('candidato_consultas_juridicas', consultaId)
    } catch (err) {
      $app
        .logger()
        .error('Consulta jurídica não encontrada', 'error', String(err), 'consulta_id', consultaId)
      return e.json(404, { error: 'Consulta jurídica não encontrada' })
    }

    let processos = []
    var procRawStr = ''
    try {
      procRawStr = consulta.getString('processos_json')
    } catch (_) {}

    if (procRawStr && procRawStr.trim()) {
      try {
        processos = JSON.parse(procRawStr) || []
      } catch (_) {
        processos = []
      }
    }

    var procEncontrado = null
    var matchedProcNum = numeroProcesso
    var cleanSearchNum = numeroProcesso.replace(/[^\d]/g, '')

    if (Array.isArray(processos)) {
      for (var i = 0; i < processos.length; i++) {
        var p = processos[i]
        if (!p || typeof p !== 'object') continue
        var num =
          p.numero_cnj ||
          p.numero ||
          p.numero_processo ||
          p.titulo ||
          (p.capa && p.capa.numero) ||
          ''
        var numStr = String(num).trim()
        var cleanNum = numStr.replace(/[^\d]/g, '')

        if (
          numStr === numeroProcesso ||
          (cleanSearchNum && cleanNum === cleanSearchNum) ||
          (procId && (procId === numeroProcesso || procId === cleanSearchNum))
        ) {
          procEncontrado = p
          if (numStr) matchedProcNum = numStr
          break
        }
      }
    }

    var detalhesEscavador = null
    var escavadorToken = $secrets.get('ESCAVADOR_API_TOKEN') || ''
    var escavadorProcId = procEncontrado && (procEncontrado.id || procEncontrado.processo_id)

    if (escavadorProcId && escavadorToken) {
      try {
        var resDet = $http.send({
          url: 'https://api.escavador.com/api/v2/processos/' + escavadorProcId,
          method: 'GET',
          headers: {
            Authorization: 'Bearer ' + escavadorToken,
            'X-Requested-With': 'XMLHttpRequest',
            Accept: 'application/json',
          },
          timeout: 8,
        })
        if (resDet && resDet.statusCode === 200 && resDet.json) {
          detalhesEscavador = resDet.json.resposta || resDet.json.data || resDet.json
        }
      } catch (escErr) {
        $app
          .logger()
          .warn('Erro ao buscar detalhes adicionais no Escavador para IA', 'error', String(escErr))
      }
    }

    var objetoAnalise = detalhesEscavador || procEncontrado
    var contexto = 'Número do processo: ' + numeroProcesso
    if (objetoAnalise) {
      try {
        contexto += '\n\nDados do processo:\n' + JSON.stringify(objetoAnalise, null, 2)
      } catch (serializeErr) {
        $app.logger().error('Erro ao serializar dados do processo', 'error', String(serializeErr))
      }
    }

    var summary = ''
    try {
      var reply = $ai.chat({
        model: 'fast',
        messages: [
          {
            role: 'system',
            content:
              'Você é um assistente jurídico especializado em análise de processos. Crie um resumo claro e conciso do processo judicial, destacando: classe processual, tribunal, assunto principal, status (ativo/inativo) e informações relevantes. Responda em português brasileiro, em no máximo 3 parágrafos.',
          },
          {
            role: 'user',
            content: contexto,
          },
        ],
      })
      summary = reply.choices[0].message.content
    } catch (err) {
      $app
        .logger()
        .error(
          'Erro ao gerar resumo via IA',
          'error',
          String(err),
          'consulta_id',
          consultaId,
          'processo',
          numeroProcesso,
        )
      if (err instanceof SkipAiConfigError) {
        return e.json(503, {
          error: 'Serviço de IA temporariamente indisponível',
        })
      }
      return e.json(502, {
        error: 'Não foi possível gerar o resumo. Tente novamente.',
      })
    }

    if (!summary || !summary.trim()) {
      $app
        .logger()
        .error('Resumo gerado está vazio', 'consulta_id', consultaId, 'processo', numeroProcesso)
      return e.json(500, {
        error: 'O resumo gerado está vazio. Tente novamente.',
      })
    }

    summary = summary.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim()

    try {
      var freshRecord = $app.findRecordById('candidato_consultas_juridicas', consultaId)

      function parseResumoObject(rec) {
        if (!rec) return {}
        var str = ''
        try {
          str = rec.getString('resumo_json')
        } catch (_) {}
        if (!str || !str.trim()) return {}
        try {
          var parsed = JSON.parse(str)
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed
          }
        } catch (_) {}
        return {}
      }

      var resumoJson = parseResumoObject(freshRecord)

      if (
        !resumoJson.processo_resumos ||
        typeof resumoJson.processo_resumos !== 'object' ||
        Array.isArray(resumoJson.processo_resumos)
      ) {
        resumoJson.processo_resumos = {}
      }

      resumoJson.processo_resumos[numeroProcesso] = summary

      if (matchedProcNum && matchedProcNum !== numeroProcesso) {
        resumoJson.processo_resumos[matchedProcNum] = summary
      }

      if (
        cleanSearchNum &&
        cleanSearchNum !== numeroProcesso &&
        cleanSearchNum !== matchedProcNum
      ) {
        resumoJson.processo_resumos[cleanSearchNum] = summary
      }

      var stringifiedJson = JSON.stringify(resumoJson)
      freshRecord.set('resumo_json', stringifiedJson)

      try {
        $app.save(freshRecord)
      } catch (saveErr) {
        $app
          .logger()
          .error(
            'Erro ao salvar com validação, tentando saveNoValidate',
            'error',
            String(saveErr),
            'consulta_id',
            consultaId,
            'processo',
            numeroProcesso,
          )
        $app.saveNoValidate(freshRecord)
      }

      var verifyRecord = $app.findRecordById('candidato_consultas_juridicas', consultaId)
      var verifyJson = parseResumoObject(verifyRecord)

      var savedSummary =
        verifyJson &&
        verifyJson.processo_resumos &&
        (verifyJson.processo_resumos[numeroProcesso] ||
          (matchedProcNum && verifyJson.processo_resumos[matchedProcNum]) ||
          (cleanSearchNum && verifyJson.processo_resumos[cleanSearchNum]))

      if (!savedSummary) {
        $app
          .logger()
          .error(
            'Verificação pós-save falhou: resumo não persistido',
            'consulta_id',
            consultaId,
            'processo',
            numeroProcesso,
          )
        return e.json(500, {
          error: 'Não foi possível salvar o resumo. Tente novamente.',
        })
      }

      $app
        .logger()
        .info(
          'Resumo IA salvo e verificado com sucesso',
          'consulta_id',
          consultaId,
          'processo',
          numeroProcesso,
        )
    } catch (err) {
      $app
        .logger()
        .error(
          'Erro ao salvar resumo da IA',
          'error',
          String(err),
          'consulta_id',
          consultaId,
          'processo',
          numeroProcesso,
        )
      return e.json(500, {
        error: 'Não foi possível salvar o resumo. Tente novamente.',
      })
    }

    return e.json(200, { summary: summary })
  },
  $apis.requireAuth(),
)
