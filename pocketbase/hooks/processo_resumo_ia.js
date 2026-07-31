routerAdd(
  'POST',
  '/backend/v1/processo/resumo-ia',
  (e) => {
    try {
      var body = e.requestInfo().body || {}
      var numeroProcesso = (body.numero_processo || body.numeroProcesso || '').toString().trim()
      var consultaId = (body.consulta_id || body.consultaId || '').toString().trim()

      if (!numeroProcesso || !consultaId) {
        $app
          .logger()
          .warn(
            'processo_resumo_ia: campos obrigatórios ausentes',
            'numeroProcesso',
            numeroProcesso,
            'consultaId',
            consultaId,
          )
        return e.json(400, { message: 'Número do processo e ID da consulta são obrigatórios' })
      }

      $app
        .logger()
        .info(
          'processo_resumo_ia: iniciando geração de resumo',
          'numeroProcesso',
          numeroProcesso,
          'consultaId',
          consultaId,
        )

      var consulta
      try {
        consulta = $app.findRecordById('candidato_consultas_juridicas', consultaId)
      } catch (err) {
        $app
          .logger()
          .error(
            'processo_resumo_ia: consulta não encontrada',
            'consultaId',
            consultaId,
            'error',
            String(err),
          )
        return e.json(404, { message: 'Consulta de processo não encontrada' })
      }

      var candidatoId = ''
      try {
        var candVal = consulta.get('candidato_id')
        if (typeof candVal === 'string') {
          candidatoId = candVal
        } else if (candVal && typeof candVal === 'object') {
          candidatoId = candVal.id || String(candVal)
        }
      } catch (_) {}
      if (!candidatoId) {
        try {
          candidatoId = consulta.getString('candidato_id') || ''
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

      if (
        processoResumos[numeroProcesso] &&
        typeof processoResumos[numeroProcesso] === 'string' &&
        processoResumos[numeroProcesso].trim()
      ) {
        $app
          .logger()
          .info(
            'processo_resumo_ia: retornando resumo em cache (numero completo)',
            'numeroProcesso',
            numeroProcesso,
          )
        return e.json(200, { message: processoResumos[numeroProcesso].trim() })
      }
      if (
        cleanNum &&
        processoResumos[cleanNum] &&
        typeof processoResumos[cleanNum] === 'string' &&
        processoResumos[cleanNum].trim()
      ) {
        $app
          .logger()
          .info(
            'processo_resumo_ia: retornando resumo em cache (numero limpo)',
            'cleanNum',
            cleanNum,
          )
        return e.json(200, { message: processoResumos[cleanNum].trim() })
      }

      var getProcessList = function (raw) {
        if (!raw) return []
        var val = raw
        if (typeof val === 'string') {
          try {
            val = JSON.parse(val)
          } catch (_) {
            return []
          }
        }
        if (Array.isArray(val)) return val
        if (typeof val === 'object' && val !== null) {
          if (Array.isArray(val.items)) return val.items
          if (Array.isArray(val.processos)) return val.processos
          if (val.resposta && Array.isArray(val.resposta.processos)) return val.resposta.processos
          if (val.resposta && Array.isArray(val.resposta.items)) return val.resposta.items
          if (Array.isArray(val.data)) return val.data
          if (Array.isArray(val.result)) return val.result
          if (val.numero_cnj || val.numero || val.id || val.titulo) return [val]
        }
        return []
      }

      var extractText = function (val) {
        if (val == null) return ''
        if (typeof val === 'string') return val.trim()
        if (typeof val === 'number') return String(val)
        if (typeof val === 'boolean') return val ? 'Sim' : 'Não'
        if (typeof val === 'object') {
          if (Array.isArray(val)) {
            var items = []
            for (var k = 0; k < Math.min(val.length, 10); k++) {
              var t = extractText(val[k])
              if (t) items.push(t)
            }
            return items.join('; ')
          }
          if (val.nome && val.tipo) return String(val.tipo).trim() + ': ' + String(val.nome).trim()
          if (val.nome) return String(val.nome).trim()
          if (val.descricao) return String(val.descricao).trim()
          if (val.sigla && val.nome)
            return String(val.sigla).trim() + ' — ' + String(val.nome).trim()
          if (val.sigla) return String(val.sigla).trim()
          if (val.display) return String(val.display).trim()
          if (val.texto) return String(val.texto).trim()
          if (val.conteudo) return String(val.conteudo).trim()
        }
        return ''
      }

      var processos = getProcessList(consulta.get('processos_json'))

      $app
        .logger()
        .info(
          'processo_resumo_ia: processos carregados da consulta',
          'totalProcessos',
          processos.length,
        )

      var procData = null
      for (var i = 0; i < processos.length; i++) {
        var p = processos[i]
        if (!p || typeof p !== 'object') continue

        var pNum = (
          p.numero_cnj ||
          p.numero ||
          p.numero_processo ||
          p.titulo ||
          p.id ||
          (p.capa && (p.capa.numero_cnj || p.capa.numero)) ||
          ''
        )
          .toString()
          .trim()

        var pNumClean = pNum.replace(/[^\d]/g, '')
        var pIdStr = p.id ? String(p.id).trim() : ''

        if (
          pNum === numeroProcesso ||
          (cleanNum && pNumClean === cleanNum) ||
          (cleanNum &&
            pNumClean &&
            (pNumClean.indexOf(cleanNum) >= 0 || cleanNum.indexOf(pNumClean) >= 0)) ||
          (pIdStr && pIdStr === numeroProcesso)
        ) {
          procData = p
          break
        }
      }

      if (!procData) {
        $app
          .logger()
          .warn(
            'processo_resumo_ia: processo não encontrado nos dados da consulta, usando dados mínimos',
            'numeroProcesso',
            numeroProcesso,
          )
        procData = { numero: numeroProcesso }
      }

      var procNum =
        extractText(procData.numero_cnj) ||
        extractText(procData.numero) ||
        extractText(procData.numero_processo) ||
        (procData.capa &&
          (extractText(procData.capa.numero_cnj) || extractText(procData.capa.numero))) ||
        extractText(procData.titulo) ||
        numeroProcesso

      var procClasse =
        extractText(procData.classe) ||
        extractText(procData.classe_processual) ||
        (procData.capa &&
          (extractText(procData.capa.classe) || extractText(procData.capa.classe_processual)))

      var procAssunto =
        extractText(procData.assunto) ||
        extractText(procData.assuntos) ||
        (procData.capa &&
          (extractText(procData.capa.assunto) || extractText(procData.capa.assuntos)))

      var procStatus =
        extractText(procData.status) ||
        extractText(procData.situacao) ||
        (procData.capa &&
          (extractText(procData.capa.status) || extractText(procData.capa.situacao)))

      var procTribunal =
        extractText(procData.tribunal) || (procData.capa && extractText(procData.capa.tribunal))

      var procVara =
        extractText(procData.orgao_julgador) ||
        extractText(procData.vara) ||
        (procData.capa &&
          (extractText(procData.capa.orgao_julgador) || extractText(procData.capa.vara)))

      var procDataAjuiz =
        extractText(procData.data_ajuizamento) ||
        extractText(procData.data_inicio) ||
        extractText(procData.data_distribuicao) ||
        (procData.capa && extractText(procData.capa.data_distribuicao))

      var procValor =
        extractText(procData.valor_causa) ||
        (procData.capa && extractText(procData.capa.valor_causa))

      var partesList =
        procData.partes ||
        procData.envolvidos ||
        (procData.capa && (procData.capa.partes || procData.capa.envolvidos))
      var partesText = ''
      if (Array.isArray(partesList) && partesList.length > 0) {
        var pList = []
        for (var j = 0; j < Math.min(partesList.length, 8); j++) {
          var pt = partesList[j]
          if (!pt) continue
          var ptNome = extractText(pt.nome || pt)
          var ptTipo = extractText(pt.tipo || pt.papel || pt.polo)
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
      } else {
        var movs =
          procData.movimentacoes ||
          procData.ultimas_movimentacoes ||
          (procData.capa && procData.capa.movimentacoes)
        if (Array.isArray(movs) && movs.length > 0) {
          var mList = []
          for (var mIdx = 0; mIdx < Math.min(movs.length, 4); mIdx++) {
            var lastM = movs[mIdx]
            var txt = extractText(lastM.conteudo || lastM.texto || lastM.descricao || lastM)
            var dt = extractText(lastM.data)
            if (txt) mList.push(dt ? '(' + dt + ') ' + txt : txt)
          }
          movText = mList.join(' | ')
        }
      }

      var contextParts = [
        'Número do Processo: ' + procNum,
        procClasse ? 'Classe Processual: ' + procClasse : '',
        procAssunto ? 'Assunto(s): ' + procAssunto : '',
        procStatus ? 'Status/Situação: ' + procStatus : '',
        procTribunal ? 'Tribunal: ' + procTribunal : '',
        procVara ? 'Vara/Órgão Julgador: ' + procVara : '',
        procDataAjuiz ? 'Data de Distribuição/Ajuizamento: ' + procDataAjuiz : '',
        procValor ? 'Valor da Causa: ' + procValor : '',
        partesText ? 'Partes/Envolvidos: ' + partesText : '',
        movText ? 'Movimentações/Andamentos: ' + movText : '',
      ].filter(function (s) {
        return s !== ''
      })

      var systemPrompt =
        'Você é um especialista em análise jurídica para recrutamento e seleção em Recursos Humanos no Brasil. ' +
        'Sua tarefa é analisar os dados fornecidos de um processo judicial brasileiro e redigir um resumo conciso, técnico, neutro e objetivo em português do Brasil (2 a 3 parágrafos). ' +
        'Destaque a classe processual, os assuntos envolvidos, o polo das partes (autor/réu), o andamento ou status atual e o contexto factual do processo sem emitir juízos de valor nem conclusões discriminatórias.'

      var userPrompt =
        'Elabore um resumo objetivo do processo judicial abaixo para auxílio na avaliação em processo seletivo de RH.\n\n' +
        'Dados do processo:\n' +
        contextParts.join('\n')

      $app
        .logger()
        .info(
          'processo_resumo_ia: chamando AI gateway',
          'numeroProcesso',
          numeroProcesso,
          'contextLength',
          contextParts.join('\n').length,
        )

      var summary = ''
      try {
        var reply = $ai.chat({
          model: 'fast',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        })

        if (reply && reply.choices && reply.choices.length > 0 && reply.choices[0].message) {
          summary = reply.choices[0].message.content || ''
        }

        $app
          .logger()
          .info(
            'processo_resumo_ia: AI gateway respondeu',
            'numeroProcesso',
            numeroProcesso,
            'summaryLength',
            summary.length,
          )
      } catch (aiErr) {
        if (typeof SkipAiConfigError !== 'undefined' && aiErr instanceof SkipAiConfigError) {
          $app
            .logger()
            .error(
              'processo_resumo_ia: SkipAiConfigError - gateway não provisionado',
              'error',
              String(aiErr),
            )
          return e.json(503, { message: 'Serviço de IA temporariamente indisponível.' })
        }
        if (typeof SkipAiError !== 'undefined' && aiErr instanceof SkipAiError) {
          $app
            .logger()
            .error(
              'processo_resumo_ia: SkipAiError - erro no gateway de IA',
              'error',
              String(aiErr),
              'status',
              aiErr.status || 0,
            )
          var skipErrDetail = (aiErr.message || String(aiErr)).trim()
          return e.json(502, {
            message: 'Erro no serviço de IA: ' + skipErrDetail,
          })
        }
        $app
          .logger()
          .error(
            'processo_resumo_ia: erro ao gerar resumo com IA',
            'error',
            String(aiErr),
            'numeroProcesso',
            numeroProcesso,
          )
        var errDetail = (aiErr && aiErr.message ? aiErr.message : String(aiErr)).trim()
        return e.json(400, {
          message: 'Não foi possível gerar o resumo com IA: ' + errDetail,
        })
      }

      if (!summary || !summary.trim()) {
        $app
          .logger()
          .warn(
            'processo_resumo_ia: IA retornou resumo vazio',
            'numeroProcesso',
            numeroProcesso,
            'consultaId',
            consultaId,
          )
        return e.json(400, { message: 'A IA não retornou um resumo válido para este processo.' })
      }

      summary = summary.trim()

      processoResumos[numeroProcesso] = summary
      if (cleanNum) processoResumos[cleanNum] = summary
      resumoJson.processo_resumos = processoResumos

      try {
        consulta.set('resumo_json', resumoJson)
        $app.saveNoValidate(consulta)
        $app
          .logger()
          .info(
            'processo_resumo_ia: resumo salvo na consulta',
            'consultaId',
            consultaId,
            'numeroProcesso',
            numeroProcesso,
          )
      } catch (saveErr) {
        $app
          .logger()
          .warn(
            'processo_resumo_ia: erro ao salvar resumo_json na consulta',
            'error',
            String(saveErr),
          )
      }

      if (candidatoId) {
        try {
          var custoRecords = $app.findRecordsByFilter('custos_consultas', '', '', 1, 0)
          if (custoRecords.length > 0) {
            var custo = Number(custoRecords[0].get('resumo_ia') || 0)
            if (custo > 0) {
              var candRec = $app.findRecordById('candidates', candidatoId)
              var currentCost = Number(candRec.get('custo_consultas') || 0)
              candRec.set('custo_consultas', currentCost + custo)
              $app.saveNoValidate(candRec)
              $app
                .logger()
                .info(
                  'processo_resumo_ia: custo incrementado no candidato',
                  'candidatoId',
                  candidatoId,
                  'custo',
                  custo,
                  'novoTotal',
                  currentCost + custo,
                )
            }
          }
        } catch (costErr) {
          $app
            .logger()
            .warn(
              'processo_resumo_ia: erro ao incrementar custo de resumo IA no candidato',
              'error',
              String(costErr),
            )
        }
      }

      $app
        .logger()
        .info(
          'processo_resumo_ia: concluído com sucesso',
          'numeroProcesso',
          numeroProcesso,
          'consultaId',
          consultaId,
        )

      return e.json(200, { message: summary })
    } catch (err) {
      $app.logger().error('processo_resumo_ia: erro não tratado', 'error', String(err))
      return e.json(500, { message: 'Erro interno ao processar o resumo. Tente novamente.' })
    }
  },
  $apis.requireAuth(),
)
