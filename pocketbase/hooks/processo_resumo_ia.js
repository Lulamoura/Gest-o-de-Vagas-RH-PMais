routerAdd(
  'POST',
  '/backend/v1/processo/resumo-ia',
  (e) => {
    try {
      var body = e.requestInfo().body || {}
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body)
        } catch (_) {
          body = {}
        }
      }

      var numeroProcesso = (body.numero_processo || body.numeroProcesso || '').toString().trim()
      var consultaId = (body.consulta_id || body.consultaId || '').toString().trim()

      if (!numeroProcesso || !consultaId) {
        console.error('processo_resumo_ia: campos obrigatórios ausentes', {
          numeroProcesso: numeroProcesso,
          consultaId: consultaId,
        })
        $app
          .logger()
          .warn(
            'processo_resumo_ia: campos obrigatórios ausentes',
            'numeroProcesso',
            numeroProcesso,
            'consultaId',
            consultaId,
          )
        return e.json(400, {
          message: 'Número do processo e ID da consulta são obrigatórios',
          error: true,
        })
      }

      console.log(
        'processo_resumo_ia: iniciando para processo',
        numeroProcesso,
        'consulta:',
        consultaId,
      )
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
        console.error('processo_resumo_ia: consulta não encontrada', consultaId, err)
        $app
          .logger()
          .error(
            'processo_resumo_ia: consulta não encontrada',
            'consultaId',
            consultaId,
            'error',
            String(err),
          )
        return e.json(404, { message: 'Consulta jurídica não encontrada.', error: true })
      }

      var candidatoId = ''
      try {
        candidatoId = consulta.getString('candidato_id') || ''
      } catch (_) {}

      var rawResumo = consulta.get('resumo_json')
      var resumoJson = {}
      if (rawResumo) {
        if (typeof rawResumo === 'string') {
          try {
            resumoJson = JSON.parse(rawResumo)
          } catch (_) {
            resumoJson = {}
          }
        } else {
          try {
            resumoJson = JSON.parse(JSON.stringify(rawResumo))
          } catch (_) {
            resumoJson = {}
          }
        }
      }
      if (typeof resumoJson !== 'object' || resumoJson === null) resumoJson = {}

      var processoResumos = resumoJson.processo_resumos || {}
      if (typeof processoResumos !== 'object' || processoResumos === null) processoResumos = {}

      var cleanNum = numeroProcesso.replace(/[^\d]/g, '')

      if (
        processoResumos[numeroProcesso] &&
        typeof processoResumos[numeroProcesso] === 'string' &&
        processoResumos[numeroProcesso].trim()
      ) {
        var cached1 = processoResumos[numeroProcesso].trim()
        console.log(
          'processo_resumo_ia: resumo retornado do cache (numero original):',
          numeroProcesso,
        )
        return e.json(200, { summary: cached1, message: cached1 })
      }
      if (
        cleanNum &&
        processoResumos[cleanNum] &&
        typeof processoResumos[cleanNum] === 'string' &&
        processoResumos[cleanNum].trim()
      ) {
        var cached2 = processoResumos[cleanNum].trim()
        console.log('processo_resumo_ia: resumo retornado do cache (numero limpo):', cleanNum)
        return e.json(200, { summary: cached2, message: cached2 })
      }

      var rawProcessos = consulta.get('processos_json')
      var processos = []
      if (rawProcessos) {
        if (typeof rawProcessos === 'string') {
          try {
            processos = JSON.parse(rawProcessos)
          } catch (_) {
            processos = []
          }
        } else {
          try {
            processos = JSON.parse(JSON.stringify(rawProcessos))
          } catch (_) {
            processos = []
          }
        }
      }
      if (!Array.isArray(processos) && typeof processos === 'object' && processos !== null) {
        if (Array.isArray(processos.items)) processos = processos.items
        else if (Array.isArray(processos.processos)) processos = processos.processos
        else if (processos.resposta && Array.isArray(processos.resposta.processos))
          processos = processos.resposta.processos
        else if (Array.isArray(processos.data)) processos = processos.data
        else processos = [processos]
      }
      if (!Array.isArray(processos)) processos = []

      console.log('processo_resumo_ia: total de processos carregados:', processos.length)

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
        console.log(
          'processo_resumo_ia: processo não encontrado nos dados da consulta, usando número direto',
        )
        procData = { numero: numeroProcesso }
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

      console.log('processo_resumo_ia: chamando AI Gateway model=fast...')
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

        if (
          reply &&
          reply.choices &&
          reply.choices.length > 0 &&
          reply.choices[0] &&
          reply.choices[0].message
        ) {
          summary = reply.choices[0].message.content || ''
        }

        console.log('processo_resumo_ia: resposta recebida da IA, tamanho:', summary.length)
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
        var aiMsg = aiErr && aiErr.message ? aiErr.message : String(aiErr)
        console.error('processo_resumo_ia: erro ao comunicar com AI Gateway:', aiMsg)
        $app
          .logger()
          .error(
            'processo_resumo_ia: erro no AI Gateway',
            'error',
            aiMsg,
            'numeroProcesso',
            numeroProcesso,
          )
        return e.json(502, {
          message: 'Falha na comunicação com a IA: ' + aiMsg,
          error: true,
        })
      }

      if (!summary || !summary.trim()) {
        console.error('processo_resumo_ia: IA retornou resumo vazio')
        $app
          .logger()
          .warn(
            'processo_resumo_ia: IA retornou resumo vazio',
            'numeroProcesso',
            numeroProcesso,
            'consultaId',
            consultaId,
          )
        return e.json(400, {
          message: 'A IA não retornou um resumo válido para este processo.',
          error: true,
        })
      }

      summary = summary.trim()

      processoResumos[numeroProcesso] = summary
      if (cleanNum) processoResumos[cleanNum] = summary
      resumoJson.processo_resumos = processoResumos

      try {
        var resumoJsonStr = JSON.stringify(resumoJson)
        console.log(
          'processo_resumo_ia: tentando salvar resumo_json na consulta',
          consultaId,
          'tamanho:',
          resumoJsonStr.length,
        )
        consulta.set('resumo_json', resumoJson)
        $app.saveNoValidate(consulta)
        console.log('processo_resumo_ia: resumo salvo na consulta', consultaId)
        $app
          .logger()
          .info(
            'processo_resumo_ia: resumo salvo na consulta',
            'consultaId',
            consultaId,
            'numeroProcesso',
            numeroProcesso,
            'resumoJsonSize',
            resumoJsonStr.length,
          )
      } catch (saveErr) {
        var saveErrMsg = saveErr && saveErr.message ? saveErr.message : String(saveErr)
        console.error('processo_resumo_ia: FALHA ao salvar resumo na consulta:', saveErrMsg)
        $app
          .logger()
          .error(
            'processo_resumo_ia: FALHA ao salvar resumo_json na consulta',
            'error',
            saveErrMsg,
            'consultaId',
            consultaId,
            'numeroProcesso',
            numeroProcesso,
            'resumoJsonSize',
            JSON.stringify(resumoJson).length,
          )
        return e.json(500, {
          message: 'Falha ao salvar o resumo da IA no banco de dados: ' + saveErrMsg,
          error: true,
        })
      }

      if (candidatoId) {
        try {
          var custoRecords = $app.findRecordsByFilter('custos_consultas', 'id != ""', '', 1, 0)
          if (custoRecords && custoRecords.length > 0) {
            var custo = Number(custoRecords[0].get('resumo_ia') || 0)
            if (custo > 0) {
              var candRec = $app.findRecordById('candidates', candidatoId)
              if (candRec) {
                var currentCost = Number(candRec.get('custo_consultas') || 0)
                candRec.set('custo_consultas', currentCost + custo)
                $app.saveNoValidate(candRec)
                console.log(
                  'processo_resumo_ia: custo atualizado no candidato:',
                  candidatoId,
                  currentCost + custo,
                )
              }
            }
          }
        } catch (costErr) {
          console.error('processo_resumo_ia: erro ao atualizar custo do candidato:', costErr)
        }
      }

      console.log('processo_resumo_ia: concluído com sucesso para', numeroProcesso)
      return e.json(200, { summary: summary, message: summary })
    } catch (err) {
      var errStr = err && err.message ? err.message : String(err)
      console.error('processo_resumo_ia: erro não tratado no hook:', errStr)
      $app.logger().error('processo_resumo_ia: erro não tratado', 'error', errStr)
      return e.json(500, {
        message: 'Erro ao processar o resumo: ' + errStr,
        error: true,
      })
    }
  },
  $apis.requireAuth(),
)
