routerAdd(
  'POST',
  '/backend/v1/processo/analise-detalhada',
  (e) => {
    const body = e.requestInfo().body || {}
    const consultaId = String(body.consulta_id || body.consultaId || '').trim()
    const processoId = String(body.processo_id || body.processoId || '').trim()

    if (!consultaId || !processoId) {
      return e.badRequestError('consulta_id e processo_id são obrigatórios')
    }

    const userId = e.auth ? e.auth.id : ''
    if (!userId) return e.unauthorizedError('Autenticação necessária')

    var localProcess = null
    try {
      var consulta = $app.findRecordById('candidato_consultas_juridicas', consultaId)
      var procs = consulta.get('processos_json')
      if (typeof procs === 'string' && procs.trim()) {
        try {
          procs = JSON.parse(procs)
        } catch (_) {
          procs = []
        }
      }
      if (Array.isArray(procs)) {
        var cleanId = processoId.replace(/[^\d]/g, '')
        for (var i = 0; i < procs.length; i++) {
          var p = procs[i]
          if (!p || typeof p !== 'object') continue
          var pId = p.id != null ? String(p.id).trim() : ''
          var pNum = (p.numero_cnj || p.numero || p.numero_processo || p.titulo || '')
            .toString()
            .trim()
          var pNumClean = pNum.replace(/[^\d]/g, '')
          if (
            (pId && (pId === processoId || (cleanId && pId === cleanId))) ||
            (pNum && pNum === processoId) ||
            (cleanId && pNumClean && pNumClean === cleanId)
          ) {
            localProcess = p
            break
          }
        }
      }
    } catch (err) {
      $app
        .logger()
        .warn('Consulta jurídica não encontrada', 'error', String(err), 'consulta_id', consultaId)
    }

    var detalhesEscavador = null
    var token = $secrets.get('ESCAVADOR_API_TOKEN')

    if (token) {
      var isDigitsOnly = /^\d+$/.test(processoId)
      var url = 'https://api.escavador.com/api/v2/processos/' + encodeURIComponent(processoId)
      if (!isDigitsOnly && processoId.includes('.')) {
        url =
          'https://api.escavador.com/api/v2/processos/numero-cnj/' + encodeURIComponent(processoId)
      }

      $app.logger().info('Buscando detalhes para análise detalhada', 'id', processoId, 'url', url)

      try {
        var procRes = $http.send({
          url: url,
          method: 'GET',
          headers: {
            Authorization: 'Bearer ' + token,
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          timeout: 15,
        })

        if (procRes.statusCode >= 200 && procRes.statusCode < 300) {
          var procData = procRes.json || {}
          if (procData.resposta && typeof procData.resposta === 'object') {
            detalhesEscavador = procData.resposta
          } else if (procData.data && typeof procData.data === 'object') {
            detalhesEscavador = procData.data
          } else {
            detalhesEscavador = procData
          }
        } else {
          $app
            .logger()
            .warn(
              'Escavador retornou status não-200 para análise',
              'statusCode',
              procRes.statusCode,
              'id',
              processoId,
            )
        }
      } catch (err) {
        $app
          .logger()
          .warn('Exceção ao chamar Escavador para análise', 'id', processoId, 'error', String(err))
      }
    }

    var objetoAnalise = detalhesEscavador || localProcess
    if (!objetoAnalise) {
      return e.json(404, { error: 'Não foi possível obter dados do processo para análise.' })
    }

    var contexto =
      'Dados completos do processo judicial:\n' + JSON.stringify(objetoAnalise, null, 2)
    if (localProcess && detalhesEscavador !== localProcess) {
      contexto +=
        '\n\nDados adicionais da consulta local:\n' + JSON.stringify(localProcess, null, 2)
    }

    var analysis = null
    try {
      var reply = $ai.chat({
        model: 'reasoning',
        messages: [
          {
            role: 'system',
            content:
              'Você é um assistente jurídico especializado em análise de processos para seleção de candidatos da PMais. ' +
              'Analise o processo judicial e retorne EXCLUSIVAMENTE um objeto JSON válido (sem markdown, sem texto adicional) com a seguinte estrutura:\n\n' +
              '{\n' +
              '  "analise_risco": "Avaliação textual do risco legal para contratação, incluindo processos trabalhistas, dívidas, registros criminais. Classifique o risco como Baixo, Médio ou Alto no início do texto.\n' +
              '  "detalhamento_partes": "Descrição das partes envolvidas (autor, réu, advogados), indicando explicitamente o papel do candidato no processo.\n' +
              '  "movimentacoes_relevantes": "Destaque das movimentações mais importantes como sentenças, acordos, despachos decisivos e o status atual do processo.\n' +
              '  "recomendacao_rh": "Recomendação clara iniciando com APROVAR ou REPROVAR, seguida de breve justificativa baseada no perfil legal."\n' +
              '}\n\n' +
              'Responda em português brasileiro. Retorne APENAS o JSON, sem markdown, sem blocos de código, sem texto antes ou depois.',
          },
          {
            role: 'user',
            content: contexto,
          },
        ],
      })

      if (reply && reply.choices && reply.choices[0] && reply.choices[0].message) {
        var content = (reply.choices[0].message.content || '').trim()

        var jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (jsonMatch) {
          content = jsonMatch[1].trim()
        }

        var jsonStart = content.indexOf('{')
        var jsonEnd = content.lastIndexOf('}')
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
          content = content.substring(jsonStart, jsonEnd + 1)
        }

        try {
          analysis = JSON.parse(content)
        } catch (parseErr) {
          $app
            .logger()
            .error(
              'Erro ao parsear JSON da IA',
              'error',
              String(parseErr),
              'content',
              content.substring(0, 500),
            )
        }
      }
    } catch (err) {
      $app
        .logger()
        .error('Erro ao gerar análise via IA', 'error', String(err), 'processo_id', processoId)
      if (err && err.name === 'SkipAiConfigError') {
        return e.json(503, { error: 'Serviço de IA temporariamente indisponível.' })
      }
      return e.json(502, { error: 'Não foi possível gerar a análise detalhada. Tente novamente.' })
    }

    if (!analysis || !analysis.analise_risco) {
      return e.json(500, {
        error: 'A análise gerada não possui os dados esperados. Tente novamente.',
      })
    }

    analysis.detalhamento_partes =
      analysis.detalhamento_partes || 'Não há informações detalhadas sobre as partes disponíveis.'
    analysis.movimentacoes_relevantes =
      analysis.movimentacoes_relevantes || 'Não há movimentações relevantes registradas.'
    analysis.recomendacao_rh =
      analysis.recomendacao_rh || 'Não foi possível determinar uma recomendação clara.'

    try {
      var freshRecord = $app.findRecordById('candidato_consultas_juridicas', consultaId)
      var resumoJson = freshRecord.get('resumo_json')
      if (typeof resumoJson === 'string') {
        try {
          resumoJson = JSON.parse(resumoJson)
        } catch (_) {
          resumoJson = {}
        }
      }
      if (!resumoJson || typeof resumoJson !== 'object' || Array.isArray(resumoJson)) {
        resumoJson = {}
      }
      if (!resumoJson.analise_detalhada || typeof resumoJson.analise_detalhada !== 'object') {
        resumoJson.analise_detalhada = {}
      }
      resumoJson.analise_detalhada[processoId] = analysis
      freshRecord.set('resumo_json', resumoJson)
      try {
        $app.save(freshRecord)
      } catch (saveErr) {
        $app.saveNoValidate(freshRecord)
      }
    } catch (err) {
      $app.logger().warn('Erro ao salvar análise no banco', 'error', String(err))
    }

    return e.json(200, analysis)
  },
  $apis.requireAuth(),
)
