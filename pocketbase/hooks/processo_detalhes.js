routerAdd(
  'GET',
  '/backend/v1/processo/{processoId}',
  (e) => {
    const processoId = e.request.pathValue('processoId')
    if (!processoId || !processoId.trim()) {
      return e.badRequestError('ID do processo é obrigatório')
    }

    const userId = e.auth ? e.auth.id : ''
    if (!userId) return e.unauthorizedError('Autenticação necessária')

    const cleanId = processoId.trim()
    const query = e.requestInfo().query || {}
    const consultaId = String(query.consulta_id || query.consultaId || '').trim()
    const numeroProcesso = String(query.numero_processo || query.numeroProcesso || '').trim()

    let localProcess = null
    if (consultaId) {
      try {
        const consulta = $app.findRecordById('candidato_consultas_juridicas', consultaId)
        if (consulta) {
          let procs = consulta.get('processos_json')
          if (typeof procs === 'string' && procs.trim()) {
            try {
              procs = JSON.parse(procs)
            } catch (_) {
              procs = []
            }
          }
          if (Array.isArray(procs)) {
            const targetClean = cleanId.replace(/[^\d]/g, '')
            const numClean = numeroProcesso.replace(/[^\d]/g, '')
            for (var i = 0; i < procs.length; i++) {
              var p = procs[i]
              if (!p || typeof p !== 'object') continue
              var pId = p.id != null ? String(p.id).trim() : ''
              var pNum = (p.numero_cnj || p.numero || p.numero_processo || p.titulo || '')
                .toString()
                .trim()
              var pNumClean = pNum.replace(/[^\d]/g, '')

              if (
                (pId && (pId === cleanId || (targetClean && pId === targetClean))) ||
                (pNum && (pNum === cleanId || pNum === numeroProcesso)) ||
                (targetClean && pNumClean && pNumClean === targetClean) ||
                (numClean && pNumClean && pNumClean === numClean)
              ) {
                localProcess = p
                break
              }
            }
          }
        }
      } catch (err) {
        $app.logger().warn('Erro ao buscar processo localmente em consulta', 'error', String(err))
      }
    }

    const token = $secrets.get('ESCAVADOR_API_TOKEN')
    if (token) {
      const isDigitsOnly = /^\d+$/.test(cleanId)
      let url = 'https://api.escavador.com/api/v2/processos/' + encodeURIComponent(cleanId)
      if (!isDigitsOnly && cleanId.includes('.')) {
        url = 'https://api.escavador.com/api/v2/processos/numero-cnj/' + encodeURIComponent(cleanId)
      }

      $app
        .logger()
        .info('Buscando detalhes do processo na API Escavador', 'id', cleanId, 'url', url)

      try {
        const procRes = $http.send({
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
          let procData = procRes.json || {}
          if (procData.resposta && typeof procData.resposta === 'object') {
            procData = procData.resposta
          } else if (procData.data && typeof procData.data === 'object') {
            procData = procData.data
          }

          if (procData && typeof procData === 'object' && Object.keys(procData).length > 0) {
            return e.json(200, procData)
          }
        } else {
          $app
            .logger()
            .warn(
              'API Escavador retornou status não-200',
              'statusCode',
              procRes.statusCode,
              'id',
              cleanId,
            )
        }
      } catch (err) {
        $app.logger().warn('Exceção ao chamar API Escavador', 'id', cleanId, 'error', String(err))
      }
    }

    if (localProcess && typeof localProcess === 'object' && Object.keys(localProcess).length > 0) {
      return e.json(200, localProcess)
    }

    if (!token) {
      return e.json(503, { error: 'Token da API Escavador não configurado no servidor.' })
    }

    return e.json(404, { error: 'Não foi possível carregar os detalhes do processo.' })
  },
  $apis.requireAuth(),
)
