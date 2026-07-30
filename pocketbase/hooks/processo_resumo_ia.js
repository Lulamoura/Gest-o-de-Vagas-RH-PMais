routerAdd(
  'POST',
  '/backend/v1/processo/resumo-ia',
  (e) => {
    const body = e.requestInfo().body || {}
    const numeroProcesso = String(body.numero_processo || '').trim()
    const consultaId = String(body.consulta_id || '').trim()

    if (!numeroProcesso || !consultaId) {
      return e.badRequestError('numero_processo e consulta_id são obrigatórios')
    }

    let consulta
    try {
      consulta = $app.findRecordById('candidato_consultas_juridicas', consultaId)
    } catch (err) {
      return e.json(404, { error: 'Consulta jurídica não encontrada' })
    }

    let processos = []
    var procRaw = consulta.get('processos_json')
    if (typeof procRaw === 'string') {
      try {
        processos = JSON.parse(procRaw) || []
      } catch (_) {
        processos = []
      }
    } else if (Array.isArray(procRaw)) {
      processos = procRaw
    }

    var procEncontrado = null
    for (var i = 0; i < processos.length; i++) {
      var p = processos[i]
      if (!p || typeof p !== 'object') continue
      var num =
        p.numero_cnj || p.numero || p.numero_processo || p.titulo || (p.capa && p.capa.numero) || ''
      if (num === numeroProcesso) {
        procEncontrado = p
        break
      }
    }

    var contexto = 'Número do processo: ' + numeroProcesso
    if (procEncontrado) {
      try {
        contexto += '\n\nDados do processo:\n' + JSON.stringify(procEncontrado, null, 2)
      } catch (_) {}
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
      return e.json(500, {
        error: 'O resumo gerado está vazio. Tente novamente.',
      })
    }

    // Re-fetch the record right before saving to avoid stale state
    try {
      var freshRecord = $app.findRecordById('candidato_consultas_juridicas', consultaId)

      var resumoRaw = freshRecord.get('resumo_json')
      var resumoJson = {}
      if (resumoRaw != null) {
        if (typeof resumoRaw === 'string') {
          try {
            resumoJson = JSON.parse(resumoRaw) || {}
          } catch (_) {
            resumoJson = {}
          }
        } else if (typeof resumoRaw === 'object') {
          resumoJson = JSON.parse(JSON.stringify(resumoRaw))
        }
      }

      if (!resumoJson.processo_resumos || typeof resumoJson.processo_resumos !== 'object') {
        resumoJson.processo_resumos = {}
      }
      resumoJson.processo_resumos[numeroProcesso] = summary

      freshRecord.set('resumo_json', resumoJson)
      $app.saveNoValidate(freshRecord)
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
