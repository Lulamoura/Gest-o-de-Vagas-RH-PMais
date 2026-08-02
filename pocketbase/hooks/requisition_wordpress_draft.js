routerAdd(
  'POST',
  '/backend/v1/requisitions/{id}/wordpress-draft',
  (e) => {
    var id = e.request.pathValue('id')
    if (!id) return e.badRequestError('ID da requisição é obrigatório')

    var req = null
    try {
      req = $app.findRecordById('requisitions', id)
    } catch (err) {
      return e.notFoundError('Requisição não encontrada')
    }

    var userId = e.auth ? e.auth.id : ''
    var userProfile = e.auth ? e.auth.getString('profile') : ''
    var isAdmin = userProfile === 'admin' || userProfile === 'superadmin'
    var isRH = false
    try {
      var deptoId = e.auth ? e.auth.getString('departamento') : ''
      if (deptoId) {
        var depto = $app.findRecordById('departamentos', deptoId)
        isRH = depto.getString('nome') === 'rh'
      }
    } catch (_) {}

    if (!isAdmin && !isRH) {
      return e.forbiddenError('Você não tem permissão para esta ação')
    }

    if (req.getString('status') !== 'Aprovada') {
      return e.badRequestError('Apenas requisições aprovadas podem criar vaga no WordPress')
    }

    var token = $secrets.get('WORDPRESS_INTEGRATION_TOKEN') || ''
    if (!token) {
      return e.json(500, { ok: false, message: 'Token de integração não configurado' })
    }

    var safeStr = function (val) {
      if (!val) return ''
      return String(val)
    }

    var resolveRelationNome = function (collectionName, relId) {
      if (!relId) return ''
      try {
        var rec = $app.findRecordById(collectionName, relId)
        return rec ? rec.getString('nome') : ''
      } catch (_) {
        return ''
      }
    }

    var safeLogError = function (msg, extraKeys) {
      try {
        var logger = $app.logger()
        var args = ['wordpress-draft: ' + msg, 'requisition_id', id]
        if (extraKeys) {
          for (var i = 0; i < extraKeys.length; i += 2) {
            args.push(extraKeys[i])
            var val = extraKeys[i + 1]
            if (typeof val === 'string' && val.length > 2000) {
              val = val.substring(0, 2000)
            }
            args.push(val)
          }
        }
        logger.error.apply(logger, args)
      } catch (_) {
        console.log('wordpress-draft: logging failed for ' + msg)
      }
    }

    var persistError = function (errorMsg) {
      try {
        var rec = $app.findRecordById('requisitions', id)
        rec.set('wordpress_sync_status', 'erro')
        rec.set('wordpress_error_message', errorMsg)
        $app.save(rec)
      } catch (_) {
        safeLogError('failed to persist error state')
      }
    }

    var statusCode = 0
    var resBody = ''

    try {
      var cargoId = safeStr(req.getString('cargo'))
      var clienteId = safeStr(req.getString('cliente'))
      var cidadeId = safeStr(req.getString('cidade'))
      var tipoVagaId = safeStr(req.getString('tipo_vaga'))
      var tipoContratoId = safeStr(req.getString('tipo_contrato'))
      var deptoId = safeStr(req.getString('departamento'))
      var solicitanteId = safeStr(req.getString('solicitante'))

      var cargoNome = resolveRelationNome('cargos', cargoId)
      var clienteNome = resolveRelationNome('clientes', clienteId)
      var cidadeNome = resolveRelationNome('cidades', cidadeId)
      var tipoVagaNome = resolveRelationNome('tipos_vaga', tipoVagaId)
      var tipoContratoNome = resolveRelationNome('tipos_contrato', tipoContratoId)
      var deptoNome = resolveRelationNome('departamentos', deptoId)
      var solicitanteNome = ''

      if (solicitanteId) {
        try {
          var solicitanteRec = $app.findRecordById('users', solicitanteId)
          if (solicitanteRec) solicitanteNome = solicitanteRec.getString('name')
        } catch (_) {}
      }

      var oeVal = safeStr(req.getString('numero_oe'))
      var quantidadeVal = req.getInt('quantidade_vagas')

      var versao = 1

      var missingFields = []

      if (!id) missingFields.push('requisition_id')
      if (!versao) missingFields.push('versao')
      if (!oeVal) missingFields.push('oe')
      if (!cargoNome) missingFields.push('titulo')
      if (!quantidadeVal || quantidadeVal <= 0) missingFields.push('quantidade')

      if (missingFields.length > 0) {
        var validationMsg = 'Campos obrigatórios ausentes ou inválidos: ' + missingFields.join(', ')
        safeLogError('local validation failed', ['missing_fields', missingFields.join(', ')])
        persistError(validationMsg)
        return e.json(400, { ok: false, message: validationMsg, missing_fields: missingFields })
      }

      var payload = {
        requisition_id: id,
        versao: versao,
        oe: oeVal,
        titulo: cargoNome,
        quantidade: quantidadeVal,
        cliente_unidade: clienteNome,
        publico: {
          localizacao: cidadeNome,
        },
        tipo_vaga: tipoVagaNome,
        tipo_contrato: tipoContratoNome,
        prazo_desejado: safeStr(req.getString('prazo_desejado')),
        prioridade: safeStr(req.getString('prioridade')),
        faixa_salarial: safeStr(req.getString('faixa_salarial')),
        especificacoes: safeStr(req.getString('especificacoes')),
        justificativa: safeStr(req.getString('justificativa')),
        observacoes_internas: safeStr(req.getString('observacoes_internas')),
        jornada: safeStr(req.getString('jornada')),
        horario: safeStr(req.getString('horario')),
        escala: safeStr(req.getString('escala')),
        remuneracao: safeStr(req.getString('remuneracao')),
        beneficios: safeStr(req.getString('beneficios')),
        requisitos: safeStr(req.getString('requisitos')),
        escolaridade: safeStr(req.getString('escolaridade')),
        experiencia: safeStr(req.getString('experiencia')),
        departamento: deptoNome,
        solicitante: solicitanteNome,
      }

      var wpUrl = 'https://pmaisservicos.com.br/wp-json/pmais-skip/v1/requisicoes/vagas'
      var bodyStr = JSON.stringify(payload)

      var res = null

      try {
        res = $http.send({
          url: wpUrl,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer ' + token,
            'User-Agent': 'PMais-GV-Integration/1.0',
          },
          body: bodyStr,
          timeout: 30,
        })
      } catch (err) {
        var netErrMsg = 'Falha de rede ao contactar WordPress'
        var errDetail = ''
        try {
          errDetail = String((err && err.message) || err || 'unknown network error')
        } catch (_) {
          errDetail = 'unknown network error'
        }
        safeLogError('network failure', ['error', errDetail])
        persistError(netErrMsg)
        return e.json(502, { ok: false, message: netErrMsg })
      }

      statusCode = (res && res.statusCode) || 0

      if (res && res.body) {
        try {
          resBody = new TextDecoder().decode(res.body)
        } catch (_) {
          try {
            resBody = res.json ? JSON.stringify(res.json) : ''
          } catch (__) {
            resBody = ''
          }
        }
      } else if (res && res.json) {
        try {
          resBody = JSON.stringify(res.json)
        } catch (_) {
          resBody = ''
        }
      }

      if (statusCode === 0) {
        var zeroMsg = 'Sem resposta do WordPress (timeout ou conexão recusada)'
        safeLogError('no response from WordPress', ['error', zeroMsg])
        persistError(zeroMsg)
        return e.json(502, { ok: false, message: zeroMsg })
      }

      if (statusCode === 406) {
        var safeHeaders = {}
        var safeKeys = ['content-type', 'allow', 'www-authenticate', 'x-powered-by']
        try {
          if (res.headers) {
            for (var k = 0; k < safeKeys.length; k++) {
              var key = safeKeys[k]
              var val = null
              try {
                val = res.headers.get ? res.headers.get(key) : res.headers[key]
              } catch (_) {
                val = res.headers[key]
              }
              if (val) safeHeaders[key] = String(val)
            }
          }
        } catch (_) {}

        safeLogError('HTTP 406 Not Acceptable', [
          'status_code',
          statusCode,
          'response_body',
          resBody,
          'safe_response_headers',
          JSON.stringify(safeHeaders),
        ])

        var msg406 = 'WordPress retornou HTTP 406. Verifique os logs do servidor.'
        persistError(msg406)
        return e.json(406, { ok: false, message: msg406 })
      }

      if (statusCode === 400) {
        var msg400 = 'Requisição inválida pelo WordPress (HTTP 400)'
        try {
          var parsed400 = JSON.parse(resBody)
          if (parsed400 && parsed400.message) msg400 = parsed400.message
          else if (parsed400 && parsed400.error) msg400 = parsed400.error
        } catch (_) {}
        safeLogError('HTTP 400', ['status_code', statusCode, 'response_body', resBody])
        persistError(msg400)
        return e.json(400, { ok: false, message: msg400 })
      }

      if (statusCode === 401 || statusCode === 403) {
        safeLogError('auth error', ['status_code', statusCode, 'response_body', resBody])
        var authMsg = 'Erro de autenticação com WordPress (HTTP ' + statusCode + ')'
        persistError(authMsg)
        return e.json(statusCode, { ok: false, message: 'Erro de autenticação com WordPress' })
      }

      if (statusCode === 422) {
        var msg422 = 'Dados inválidos (HTTP 422)'
        try {
          var parsed422 = JSON.parse(resBody)
          if (parsed422 && parsed422.message) msg422 = parsed422.message
          else if (parsed422 && parsed422.error) msg422 = parsed422.error
        } catch (_) {}
        safeLogError('HTTP 422', ['status_code', statusCode, 'response_body', resBody])
        persistError(msg422)
        return e.json(422, { ok: false, message: msg422 })
      }

      if (statusCode >= 500) {
        safeLogError('server error', ['status_code', statusCode, 'response_body', resBody])
        var serverMsg = 'Erro no servidor WordPress (HTTP ' + statusCode + ')'
        persistError(serverMsg)
        return e.json(502, { ok: false, message: 'Erro no servidor WordPress' })
      }

      var isDuplicate = false
      var wpJobId = ''
      var wpAdminUrl = ''

      if (statusCode === 200 || statusCode === 201) {
        try {
          var parsed = JSON.parse(resBody)
          if (parsed && parsed.duplicate === true) {
            isDuplicate = true
          }
          if (parsed && parsed.wordpress_job_id) {
            wpJobId = String(parsed.wordpress_job_id)
          }
          if (parsed && parsed.wordpress_admin_url) {
            wpAdminUrl = String(parsed.wordpress_admin_url)
          }
        } catch (_) {}
      }

      if (statusCode === 201 || (statusCode === 200 && isDuplicate)) {
        var today = new Date().toISOString().split('T')[0]
        var successRec = $app.findRecordById('requisitions', id)
        successRec.set('wordpress_sync_status', 'sucesso')
        successRec.set('wordpress_sync_date', today)
        successRec.set('wordpress_error_message', '')

        if (wpJobId) successRec.set('wordpress_job_id', wpJobId)
        if (wpAdminUrl) successRec.set('wordpress_admin_url', wpAdminUrl)

        successRec.set('status', 'Rascunho criado no WordPress')
        $app.save(successRec)

        try {
          var historyCol = $app.findCollectionByNameOrId('requisition_history')
          var historyRecord = new Record(historyCol)
          historyRecord.set('requisition_id', id)
          historyRecord.set('usuario_id', userId)
          historyRecord.set('status_anterior', 'Aprovada')
          historyRecord.set('status_novo', 'Rascunho criado no WordPress')
          historyRecord.set('acao', 'Rascunho criado no WordPress')
          historyRecord.set(
            'observacao',
            isDuplicate ? 'Vaga duplicada no WordPress' : 'Vaga criada no WordPress',
          )
          $app.save(historyRecord)
        } catch (histErr) {
          safeLogError('history save failed', ['error', String(histErr)])
        }

        return e.json(200, {
          ok: true,
          duplicate: isDuplicate,
          wordpress_job_id: wpJobId,
          wordpress_admin_url: wpAdminUrl,
        })
      }

      safeLogError('unexpected status', ['status_code', statusCode, 'response_body', resBody])
      var unexpectedMsg = 'Resposta inesperada do WordPress (HTTP ' + statusCode + ')'
      persistError(unexpectedMsg)
      return e.json(502, { ok: false, message: unexpectedMsg })
    } catch (err) {
      var catchMsg = ''
      var catchStack = ''
      try {
        catchMsg = String((err && err.message) || err || 'unknown error')
      } catch (_) {
        catchMsg = 'unknown error'
      }
      try {
        catchStack = String((err && err.stack) || '')
      } catch (_) {
        catchStack = ''
      }

      safeLogError('unhandled exception', [
        'error',
        catchMsg,
        'stack',
        catchStack,
        'status_code',
        statusCode,
      ])

      var safeDiag = 'Erro interno ao processar resposta do WordPress'
      if (catchMsg && catchMsg !== 'unknown error') {
        safeDiag = safeDiag + ': ' + catchMsg.substring(0, 200)
      }
      persistError(safeDiag)
      return e.json(502, { ok: false, message: safeDiag })
    }
  },
  $apis.requireAuth(),
)
