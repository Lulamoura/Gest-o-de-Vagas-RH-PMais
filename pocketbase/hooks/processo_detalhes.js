routerAdd(
  'GET',
  '/backend/v1/processo/{id}',
  (e) => {
    const rawId = e.request.pathValue('id') || ''
    const processoId = decodeURIComponent(rawId).trim()

    const query = e.requestInfo().query || {}
    const consultaId = (query.consulta_id || query.consultaId || '').trim()
    const numeroProcesso = (query.numero_processo || query.numeroProcesso || '').trim()
    const candidatoId = (query.candidato_id || query.candidatoId || '').trim()
    const queryCpf = (query.cpf || '').trim()

    if (!processoId && !numeroProcesso) {
      return e.json(400, { error: 'Não foi possível carregar os detalhes do processo.' })
    }

    const targetProc = numeroProcesso || processoId
    const cleanCNJ = targetProc.replace(/[^\d]/g, '')

    const findMatchingProcess = (procs, pIdTarget, targetP, cCNJ) => {
      if (!Array.isArray(procs)) return null
      for (let i = 0; i < procs.length; i++) {
        const p = procs[i]
        if (!p || typeof p !== 'object') continue
        const pId = p.id != null ? String(p.id).trim() : ''
        const pNum = (p.numero_cnj || p.numero || p.numero_processo || p.titulo || '')
          .toString()
          .trim()
        const pNumClean = pNum.replace(/[^\d]/g, '')

        if (
          (pId && (pId === pIdTarget || pId === targetP)) ||
          (pNum && (pNum === pIdTarget || pNum === targetP)) ||
          (cCNJ &&
            cCNJ.length >= 8 &&
            pNumClean &&
            (pNumClean === cCNJ || pNumClean.includes(cCNJ) || cCNJ.includes(pNumClean))) ||
          (p.titulo && targetP && p.titulo.toLowerCase().includes(targetP.toLowerCase()))
        ) {
          return p
        }
      }
      return null
    }

    let localProcess = null
    let candidateCpf = queryCpf

    // 1. Search in local database (candidato_consultas_juridicas) by consulta_id
    if (consultaId) {
      try {
        const consulta = $app.findRecordById('candidato_consultas_juridicas', consultaId)
        if (consulta) {
          if (!candidateCpf) candidateCpf = (consulta.get('cpf_consultado') || '').trim()
          let procs = consulta.get('processos_json')
          if (typeof procs === 'string' && procs.trim()) {
            try {
              procs = JSON.parse(procs)
            } catch (_) {
              procs = []
            }
          }
          if (Array.isArray(procs)) {
            localProcess = findMatchingProcess(procs, processoId, targetProc, cleanCNJ)
          }
        }
      } catch (err) {
        $app
          .logger()
          .warn('Consulta não encontrada por ID', 'consultaId', consultaId, 'error', String(err))
      }
    }

    // 2. Fallback search in candidate's legal consultations
    if (!localProcess && (candidatoId || candidateCpf)) {
      try {
        let filter = ''
        if (candidatoId) filter = 'candidato_id = "' + candidatoId + '"'
        else if (candidateCpf) filter = 'cpf_consultado = "' + candidateCpf + '"'

        if (filter) {
          const records = $app.findRecordsByFilter(
            'candidato_consultas_juridicas',
            filter,
            '-created',
            10,
            0,
          )
          for (let r = 0; r < records.length; r++) {
            const rec = records[r]
            if (!candidateCpf) candidateCpf = (rec.get('cpf_consultado') || '').trim()
            let procs = rec.get('processos_json')
            if (typeof procs === 'string' && procs.trim()) {
              try {
                procs = JSON.parse(procs)
              } catch (_) {
                procs = []
              }
            }
            if (Array.isArray(procs)) {
              const matched = findMatchingProcess(procs, processoId, targetProc, cleanCNJ)
              if (matched) {
                localProcess = matched
                break
              }
            }
          }
        }
      } catch (err) {
        $app.logger().warn('Erro ao buscar consultas do candidato', 'error', String(err))
      }
    }

    // 3. Query Escavador API if token available
    let detalhesEscavador = null
    const token = $secrets.get('ESCAVADOR_API_TOKEN')

    if (token) {
      const headers = {
        Authorization: 'Bearer ' + token,
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      }

      let urlsToTry = []
      if (cleanCNJ && cleanCNJ.length >= 15) {
        urlsToTry.push(
          'https://api.escavador.com/api/v2/processos/numero-cnj/' + encodeURIComponent(targetProc),
        )
        urlsToTry.push(
          'https://api.escavador.com/api/v2/processos/numero-cnj/' + encodeURIComponent(cleanCNJ),
        )
      } else if (/^\d+$/.test(targetProc)) {
        urlsToTry.push(
          'https://api.escavador.com/api/v2/processos/' + encodeURIComponent(targetProc),
        )
      } else {
        urlsToTry.push(
          'https://api.escavador.com/api/v2/processos/numero-cnj/' + encodeURIComponent(targetProc),
        )
      }

      for (let u = 0; u < urlsToTry.length; u++) {
        const url = urlsToTry[u]
        $app.logger().info('Buscando capa do processo no Escavador', 'url', url)
        try {
          const res = $http.send({ url: url, method: 'GET', headers: headers, timeout: 15 })
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const procData = res.json || {}
            let data = null
            if (procData.resposta && typeof procData.resposta === 'object') data = procData.resposta
            else if (procData.data && typeof procData.data === 'object') data = procData.data
            else data = procData

            if (data && (data.numero_cnj || data.fontes || data.capa || data.id)) {
              detalhesEscavador = data
              break
            }
          }
        } catch (err) {
          $app
            .logger()
            .warn('Erro ao consultar Escavador por número', 'url', url, 'error', String(err))
        }
      }

      // 4. Smart Search Fallback: search involved party processes by CPF if direct lookup failed
      if (!detalhesEscavador && candidateCpf) {
        const cleanCpfDigits = candidateCpf.replace(/[^\d]/g, '')
        if (cleanCpfDigits.length === 11) {
          try {
            $app
              .logger()
              .info('Buscando envolvido no Escavador por CPF (fallback)', 'cpf', cleanCpfDigits)
            const resEnvolvido = $http.send({
              url:
                'https://api.escavador.com/api/v2/envolvido/processos?cpf_cnpj=' +
                encodeURIComponent(cleanCpfDigits),
              method: 'GET',
              headers: headers,
              timeout: 15,
            })
            if (resEnvolvido.statusCode >= 200 && resEnvolvido.statusCode < 300) {
              const envJson = resEnvolvido.json || {}
              let envItems = []
              if (Array.isArray(envJson.resposta?.items)) envItems = envJson.resposta.items
              else if (Array.isArray(envJson.resposta?.processos))
                envItems = envJson.resposta.processos
              else if (Array.isArray(envJson.resposta)) envItems = envJson.resposta
              else if (Array.isArray(envJson.items)) envItems = envJson.items
              else if (Array.isArray(envJson.data)) envItems = envJson.data

              if (envItems.length > 0) {
                const matched = findMatchingProcess(envItems, processoId, targetProc, cleanCNJ)
                if (matched) {
                  detalhesEscavador = matched
                }
              }
            }
          } catch (errEnv) {
            $app.logger().warn('Erro no fallback por CPF no Escavador', 'error', String(errEnv))
          }
        }
      }
    }

    if (detalhesEscavador && candidatoId) {
      try {
        const custoRecords = $app.findRecordsByFilter('custos_consultas', '', '', 1, 0)
        if (custoRecords.length > 0) {
          const custo = Number(custoRecords[0].get('capa_processo') || 0)
          if (custo > 0) {
            const candRec = $app.findRecordById('candidates', candidatoId)
            const currentCost = Number(candRec.get('custo_consultas') || 0)
            candRec.set('custo_consultas', currentCost + custo)
            $app.saveNoValidate(candRec)
          }
        }
      } catch (costErr) {
        $app
          .logger()
          .warn('Erro ao incrementar custo de capa do processo', 'error', String(costErr))
      }
    }

    let finalData = null
    if (detalhesEscavador && localProcess) {
      finalData = Object.assign({}, localProcess, detalhesEscavador)
    } else {
      finalData = detalhesEscavador || localProcess
    }

    if (!finalData) {
      return e.json(404, { error: 'Não foi possível carregar os detalhes do processo.' })
    }

    return e.json(200, finalData)
  },
  $apis.requireAuth(),
)
