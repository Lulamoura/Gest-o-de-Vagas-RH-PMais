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
      $app
        .logger()
        .error('Consulta jurídica não encontrada', 'error', String(err), 'consulta_id', consultaId)
      return e.json(404, { error: 'Consulta jurídica não encontrada' })
    }

    let processos = []
    var procRaw = consulta.get('processos_json')
    if (typeof procRaw === 'string') {
      try {
        processos = JSON.parse(procRaw) || []
      } catch (parseErr) {
        $app
          .logger()
          .error(
            'Erro ao parsear processos_json',
            'error',
            String(parseErr),
            'consulta_id',
            consultaId,
          )
        processos = []
      }
    } else if (Array.isArray(procRaw)) {
      processos = JSON.parse(JSON.stringify(procRaw))
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
      } catch (serializeErr) {
        $app
          .logger()
          .error(
            'Erro ao serializar dados do processo',
            'error',
            String(serializeErr),
            'consulta_id',
            consultaId,
            'processo',
            numeroProcesso,
          )
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

    try {
      var freshRecord = $app.findRecordById('candidato_consultas_juridicas', consultaId)

      var resumoRaw = freshRecord.get('resumo_json')
      var resumoJson = {}
      if (resumoRaw != null) {
        if (typeof resumoRaw === 'string') {
          if (resumoRaw.trim()) {
            try {
              var parsed = JSON.parse(resumoRaw)
              resumoJson = typeof parsed === 'object' && parsed !== null ? parsed : {}
            } catch (parseErr) {
              $app
                .logger()
                .error(
                  'Erro ao parsear resumo_json existente',
                  'error',
                  String(parseErr),
                  'consulta_id',
                  consultaId,
                )
              resumoJson = {}
            }
          }
        } else if (typeof resumoRaw === 'object') {
          try {
            resumoJson = JSON.parse(JSON.stringify(resumoRaw))
          } catch (cloneErr) {
            $app
              .logger()
              .error(
                'Erro ao clonar resumo_json existente',
                'error',
                String(cloneErr),
                'consulta_id',
                consultaId,
              )
            resumoJson = {}
          }
        }
      }

      if (!resumoJson.processo_resumos || typeof resumoJson.processo_resumos !== 'object') {
        resumoJson.processo_resumos = {}
      }
      resumoJson.processo_resumos[numeroProcesso] = summary

      var cleanJson
      try {
        cleanJson = JSON.parse(JSON.stringify(resumoJson))
      } catch (cleanErr) {
        $app
          .logger()
          .error(
            'Erro ao limpar resumo_json antes de salvar',
            'error',
            String(cleanErr),
            'consulta_id',
            consultaId,
          )
        return e.json(500, {
          error: 'Não foi possível salvar o resumo. Tente novamente.',
        })
      }

      freshRecord.set('resumo_json', cleanJson)

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
      var verifyRaw = verifyRecord.get('resumo_json')
      var verifyJson = null
      if (typeof verifyRaw === 'string') {
        try {
          verifyJson = JSON.parse(verifyRaw)
        } catch (_) {}
      } else if (typeof verifyRaw === 'object') {
        verifyJson = verifyRaw
      }
      if (
        !verifyJson ||
        !verifyJson.processo_resumos ||
        !verifyJson.processo_resumos[numeroProcesso]
      ) {
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
