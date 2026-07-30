routerAdd(
  'GET',
  '/backend/v1/processo/{id}',
  (e) => {
    const rawId = e.request.pathValue('id') || ''
    const processoId = decodeURIComponent(rawId).trim()

    const query = e.requestInfo().query || {}
    const consultaId = (query.consulta_id || query.consultaId || '').trim()
    const numeroProcesso = (query.numero_processo || query.numeroProcesso || '').trim()

    if (!processoId && !numeroProcesso) {
      return e.json(400, { error: 'Não foi possível carregar os detalhes do processo.' })
    }

    const targetProc = numeroProcesso || processoId
    const cleanCNJ = targetProc.replace(/[^\d]/g, '')

    let localProcess = null

    if (consultaId) {
      try {
        const consulta = $app.findRecordById('candidato_consultas_juridicas', consultaId)
        let procs = consulta.get('processos_json')
        if (typeof procs === 'string' && procs.trim()) {
          try {
            procs = JSON.parse(procs)
          } catch (_) {
            procs = []
          }
        }
        if (Array.isArray(procs)) {
          for (let i = 0; i < procs.length; i++) {
            const p = procs[i]
            if (!p || typeof p !== 'object') continue
            const pId = p.id != null ? String(p.id).trim() : ''
            const pNum = (p.numero_cnj || p.numero || p.numero_processo || p.titulo || '')
              .toString()
              .trim()
            const pNumClean = pNum.replace(/[^\d]/g, '')

            if (
              (pId && (pId === processoId || (cleanCNJ && pId === cleanCNJ))) ||
              (pNum && (pNum === processoId || pNum === targetProc)) ||
              (cleanCNJ && pNumClean && pNumClean === cleanCNJ)
            ) {
              localProcess = p
              break
            }
          }
        }
      } catch (err) {
        $app
          .logger()
          .warn(
            'Consulta jurídica não encontrada para busca de capa',
            'error',
            String(err),
            'consultaId',
            consultaId,
          )
      }
    }

    let detalhesEscavador = null
    const token = $secrets.get('ESCAVADOR_API_TOKEN')

    if (token) {
      let url = ''
      const isDigitsOnly = /^\d+$/.test(targetProc)

      if (isDigitsOnly && targetProc.length < 15) {
        url = 'https://api.escavador.com/api/v2/processos/' + encodeURIComponent(targetProc)
      } else {
        url =
          'https://api.escavador.com/api/v2/processos/numero-cnj/' + encodeURIComponent(targetProc)
      }

      $app.logger().info('Buscando capa do processo no Escavador', 'url', url)

      try {
        const res = $http.send({
          url: url,
          method: 'GET',
          headers: {
            Authorization: 'Bearer ' + token,
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          timeout: 15,
        })

        if (res.statusCode >= 200 && res.statusCode < 300) {
          const procData = res.json || {}
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
              'Escavador retornou status não-200 para capa',
              'statusCode',
              res.statusCode,
              'targetProc',
              targetProc,
            )
        }
      } catch (err) {
        $app
          .logger()
          .warn(
            'Exceção na chamada Escavador para capa',
            'targetProc',
            targetProc,
            'error',
            String(err),
          )
      }
    }

    const finalData = detalhesEscavador || localProcess

    if (!finalData) {
      return e.json(404, { error: 'Não foi possível carregar os detalhes do processo.' })
    }

    return e.json(200, finalData)
  },
  $apis.requireAuth(),
)
