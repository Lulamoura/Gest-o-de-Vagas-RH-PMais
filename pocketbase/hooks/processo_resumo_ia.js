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
      return e.json(404, { error: 'Consulta de processo nao encontrada' })
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

    if (processoResumos[numeroProcesso] && typeof processoResumos[numeroProcesso] === 'string') {
      return e.json(200, { summary: processoResumos[numeroProcesso] })
    }
    if (cleanNum && processoResumos[cleanNum] && typeof processoResumos[cleanNum] === 'string') {
      return e.json(200, { summary: processoResumos[cleanNum] })
    }

    var extractText = function (val) {
      if (val == null) return ''
      if (typeof val === 'string') return val.trim()
      if (typeof val === 'number') return String(val)
      if (typeof val === 'object') {
        if (Array.isArray(val)) {
          var items = []
          for (var k = 0; k < val.length; k++) {
            var t = extractText(val[k])
            if (t) items.push(t)
          }
          return items.join(', ')
        }
        if (val.nome) return String(val.nome).trim()
        if (val.descricao) return String(val.descricao).trim()
        if (val.sigla && val.nome) return String(val.sigla).trim() + ' — ' + String(val.nome).trim()
        if (val.sigla) return String(val.sigla).trim()
        if (val.display) return String(val.display).trim()
        if (val.texto) return String(val.texto).trim()
      }
      return ''
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
      var pNum = (p.numero_cnj || p.numero || p.numero_processo || p.titulo || p.id || '')
        .toString()
        .trim()
      var pNumClean = pNum.replace(/[^\d]/g, '')
      if (
        pNum === numeroProcesso ||
        (cleanNum && pNumClean === cleanNum) ||
        (cleanNum &&
          pNumClean &&
          (pNumClean.indexOf(cleanNum) >= 0 || cleanNum.indexOf(pNumClean) >= 0)) ||
        (p.id && String(p.id).trim() === numeroProcesso)
      ) {
        procData = p
        break
      }
    }

    if (!procData) {
      procData = { numero: numeroProcesso }
    }

    var procNum =
      extractText(procData.numero_cnj) ||
      extractText(procData.numero) ||
      extractText(procData.numero_processo) ||
      extractText(procData.titulo) ||
      numeroProcesso

    var procClasse = extractText(procData.classe) || extractText(procData.classe_processual)
    var procAssunto = extractText(procData.assunto) || extractText(procData.assuntos)
    var procStatus = extractText(procData.status) || extractText(procData.situacao)
    var procTribunal = extractText(procData.tribunal)
    var procVara = extractText(procData.orgao_julgador) || extractText(procData.vara)

    var partesText = ''
    if (Array.isArray(procData.partes) && procData.partes.length > 0) {
      var pList = []
      for (var j = 0; j < Math.min(procData.partes.length, 6); j++) {
        var pt = procData.partes[j]
        if (!pt) continue
        var ptNome = extractText(pt.nome || pt)
        var ptTipo = extractText(pt.tipo || pt.papel)
        if (ptNome) {
          pList.push(ptTipo ? ptTipo + ': ' + ptNome : ptNome)
        }
      }
      partesText = pList.join('; ')
    }

    var movText = ''
    if (procData.last_valid_movement) {
      movText = extractText(
        procData.last_valid_movement.conteudo ||
          procData.last_valid_movement.texto ||
          procData.last_valid_movement,
      )
    } else if (Array.isArray(procData.movimentacoes) && procData.movimentacoes.length > 0) {
      var lastM = procData.movimentacoes[0]
      movText = extractText(lastM.conteudo || lastM.texto || lastM)
    }

    var contextParts = [
      'Número do Processo: ' + procNum,
      procClasse ? 'Classe: ' + procClasse : '',
      procAssunto ? 'Assunto: ' + procAssunto : '',
      procStatus ? 'Status: ' + procStatus : '',
      procTribunal ? 'Tribunal: ' + procTribunal : '',
      procVara ? 'Vara/Órgão Julgador: ' + procVara : '',
      partesText ? 'Partes: ' + partesText : '',
      movText ? 'Última Movimentação: ' + movText : '',
    ].filter(function (s) {
      return s !== ''
    })

    var prompt =
      'Resuma de forma clara e objetiva o seguinte processo judicial para fins de avaliacao de candidato em processo seletivo de RH. ' +
      'Destaque informacoes relevantes como o tipo de acao, a situacao/status, e se ha riscos potenciais. ' +
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
              'Voce e um assistente juridico especialista em RH que resume processos judiciais de forma concisa e objetiva em portugues brasileiro. Limite o resumo a 2-3 paragrafos claros.',
          },
          { role: 'user', content: prompt },
        ],
      })
      if (reply && reply.choices && reply.choices.length > 0 && reply.choices[0].message) {
        summary = reply.choices[0].message.content || ''
      }
    } catch (aiErr) {
      $app.logger().error('Erro ao gerar resumo com IA', 'error', String(aiErr))
      var errDetail = aiErr && aiErr.message ? aiErr.message : String(aiErr)
      return e.json(500, { error: 'Não foi possível gerar o resumo com IA: ' + errDetail })
    }

    if (!summary || !summary.trim()) {
      return e.json(500, { error: 'A IA não retornou um resumo válido para este processo.' })
    }

    summary = summary.trim()

    processoResumos[numeroProcesso] = summary
    if (cleanNum) processoResumos[cleanNum] = summary
    resumoJson.processo_resumos = processoResumos

    try {
      consulta.set('resumo_json', resumoJson)
      $app.saveNoValidate(consulta)
    } catch (saveErr) {
      $app.logger().warn('Erro ao salvar resumo_json na consulta', 'error', String(saveErr))
    }

    if (candidatoId) {
      try {
        var custoRec = null
        try {
          custoRec = $app.findFirstRecordByFilter('custos_consultas', '1=1')
        } catch (_) {}

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
