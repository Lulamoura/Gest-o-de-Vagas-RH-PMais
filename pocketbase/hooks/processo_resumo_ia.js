routerAdd(
  'POST',
  '/backend/v1/processo/resumo-ia',
  (e) => {
    const body = e.requestInfo().body || {}
    const numeroProcesso = (body.numero_processo || body.numeroProcesso || '').trim()
    const consultaId = (body.consulta_id || body.consultaId || '').trim()

    if (!numeroProcesso || !consultaId) {
      return e.badRequestError('Numero do processo e ID da consulta sao obrigatorios')
    }

    let consulta
    try {
      consulta = $app.findRecordById('candidato_consultas_juridicas', consultaId)
    } catch (err) {
      return e.json(404, { error: 'Consulta nao encontrada' })
    }

    var candidatoId = ''
    try {
      candidatoId = consulta.getString('candidato_id') || ''
    } catch (_) {
      try {
        var candField = consulta.get('candidato_id')
        if (candField) {
          candidatoId = typeof candField === 'string' ? candField : String(candField)
        }
      } catch (_) {}
    }

    var resumoJson = consulta.get('resumo_json')
    if (resumoJson == null) resumoJson = {}
    if (typeof resumoJson === 'string') {
      try {
        resumoJson = JSON.parse(resumoJson)
      } catch (_) {
        resumoJson = {}
      }
    }
    if (typeof resumoJson !== 'object' || resumoJson == null) resumoJson = {}

    var processoResumos = resumoJson.processo_resumos || {}
    if (typeof processoResumos !== 'object' || processoResumos == null) processoResumos = {}

    var cleanNum = numeroProcesso.replace(/[^\d]/g, '')

    if (processoResumos[numeroProcesso]) {
      return e.json(200, { summary: processoResumos[numeroProcesso] })
    }
    if (cleanNum && processoResumos[cleanNum]) {
      return e.json(200, { summary: processoResumos[cleanNum] })
    }

    var processos = consulta.get('processos_json')
    if (typeof processos === 'string') {
      try {
        processos = JSON.parse(processos)
      } catch (_) {
        processos = []
      }
    }
    if (!Array.isArray(processos)) processos = []

    var procData = null
    for (var i = 0; i < processos.length; i++) {
      var p = processos[i]
      if (!p || typeof p !== 'object') continue
      var pNum = (p.numero_cnj || p.numero || p.numero_processo || p.titulo || '').toString().trim()
      var pNumClean = pNum.replace(/[^\d]/g, '')
      if (
        pNum === numeroProcesso ||
        (cleanNum && pNumClean === cleanNum) ||
        (cleanNum &&
          pNumClean &&
          (pNumClean.indexOf(cleanNum) >= 0 || cleanNum.indexOf(pNumClean) >= 0))
      ) {
        procData = p
        break
      }
    }

    if (!procData) {
      procData = { numero: numeroProcesso }
    }

    var procNum = (
      procData.numero_cnj ||
      procData.numero ||
      procData.numero_processo ||
      procData.titulo ||
      numeroProcesso
    ).toString()
    var procClasse = (procData.classe || procData.classe_processual || '').toString()
    var procAssunto = (procData.assunto || '').toString()
    var procStatus = (procData.status || procData.situacao || '').toString()
    var procTribunal = (procData.tribunal || '').toString()

    var contextParts = [
      'Numero: ' + procNum,
      procClasse ? 'Classe: ' + procClasse : '',
      procAssunto ? 'Assunto: ' + procAssunto : '',
      procStatus ? 'Status: ' + procStatus : '',
      procTribunal ? 'Tribunal: ' + procTribunal : '',
    ].filter(function (s) {
      return s !== ''
    })

    var prompt =
      'Resuma de forma clara e objetiva o seguinte processo judicial para fins de avaliacao de candidato em processo seletivo. ' +
      'Destaque informacoes relevantes como o tipo de acao, o status, e se ha riscos potenciais. ' +
      'Contexto do processo:\n' +
      contextParts.join('\n')

    var summary = ''
    try {
      var reply = $ai.chat({
        model: 'fast',
        messages: [
          {
            role: 'system',
            content:
              'Voce e um assistente juridico que resume processos judiciais de forma concisa e objetiva, em portugues brasileiro. Limite o resumo a 3-4 paragrafos.',
          },
          { role: 'user', content: prompt },
        ],
      })
      summary = reply.choices[0].message.content || ''
    } catch (aiErr) {
      $app.logger().error('Erro ao gerar resumo com IA', 'error', String(aiErr))
      return e.json(500, { error: 'Nao foi possivel gerar o resumo. Tente novamente mais tarde.' })
    }

    if (!summary.trim()) {
      return e.json(500, { error: 'Nao foi possivel gerar o resumo. Tente novamente mais tarde.' })
    }

    processoResumos[numeroProcesso] = summary
    if (cleanNum) processoResumos[cleanNum] = summary
    resumoJson.processo_resumos = processoResumos

    try {
      consulta.set('resumo_json', resumoJson)
      $app.saveNoValidate(consulta)
    } catch (saveErr) {
      $app.logger().warn('Erro ao salvar resumo', 'error', String(saveErr))
    }

    if (candidatoId) {
      try {
        var custoRec = $app.findFirstRecordByFilter('custos_consultas', '1=1')
        if (custoRec) {
          var custo = Number(custoRec.get('resumo_ia') || 0)
          if (custo > 0) {
            var candRec = $app.findRecordById('candidates', candidatoId)
            var currentCost = Number(candRec.get('custo_consultas') || 0)
            candRec.set('custo_consultas', currentCost + custo)
            $app.saveNoValidate(candRec)
          }
        }
      } catch (costErr) {
        $app.logger().warn('Erro ao incrementar custo de resumo IA', 'error', String(costErr))
      }
    }

    return e.json(200, { summary: summary })
  },
  $apis.requireAuth(),
)
