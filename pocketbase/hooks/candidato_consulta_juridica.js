routerAdd(
  'POST',
  '/backend/v1/candidatos/{id}/consulta-juridica',
  (e) => {
    const candidateId = e.request.pathValue('id')
    const userId = e.auth ? e.auth.id : ''
    if (!userId) return e.unauthorizedError('Autenticação necessária')

    const userProfile = e.auth ? e.auth.getString('profile') : ''
    if (userProfile !== 'admin' && userProfile !== 'superadmin') {
      return e.forbiddenError('Apenas administradores podem realizar consultas jurídicas')
    }

    let candidate
    try {
      candidate = $app.findRecordById('candidates', candidateId)
    } catch (err) {
      return e.json(404, { error: 'Candidato não encontrado' })
    }

    const cpfRaw = candidate.getString('cpf') || ''
    const nome = candidate.getString('nome') || ''
    const cleanCpf = cpfRaw.replace(/\D/g, '')

    if (!cleanCpf || cleanCpf.length !== 11 || /^(\d)\1{10}$/.test(cleanCpf)) {
      return e.badRequestError('CPF inválido ou não cadastrado para este candidato')
    }

    let sum = 0
    for (let i = 0; i < 9; i++) sum += parseInt(cleanCpf[i]) * (10 - i)
    let rev = 11 - (sum % 11)
    if (rev >= 10) rev = 0
    if (rev !== parseInt(cleanCpf[9])) return e.badRequestError('CPF inválido')
    sum = 0
    for (let i = 0; i < 10; i++) sum += parseInt(cleanCpf[i]) * (11 - i)
    rev = 11 - (sum % 11)
    if (rev >= 10) rev = 0
    if (rev !== parseInt(cleanCpf[10])) return e.badRequestError('CPF inválido')

    const token = $secrets.get('ESCAVADOR_API_TOKEN')
    if (!token) {
      return e.json(503, { error: 'Token da API Escavador não configurado. Contate o suporte.' })
    }

    const baseUrl = 'https://api.escavador.com'
    let statusConsulta = 'sucesso'
    let erroMsg = ''
    let items = []
    let total = 0
    let ativos = 0
    let inativos = 0
    let resumoData = null

    try {
      const procRes = $http.send({
        url: baseUrl + '/api/v2/envolvido/processos?cpf_cnpj=' + cleanCpf + '&limit=100',
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        timeout: 30,
      })

      if (procRes.statusCode === 404) {
        statusConsulta = 'sem_resultados'
      } else if (procRes.statusCode === 429) {
        statusConsulta = 'erro'
        erroMsg =
          'Limite de consultas excedido na API Escavador. Tente novamente em alguns minutos.'
      } else if (procRes.statusCode === 401 || procRes.statusCode === 403) {
        statusConsulta = 'erro'
        erroMsg = 'Token da API Escavador inválido ou expirado.'
      } else if (procRes.statusCode < 200 || procRes.statusCode >= 300) {
        statusConsulta = 'erro'
        erroMsg = 'Erro ao consultar API Escavador (HTTP ' + procRes.statusCode + ').'
      } else {
        const procData = procRes.json || {}
        if (Array.isArray(procData.items)) {
          items = procData.items
          total = procData.total || items.length
        } else if (procData.data && Array.isArray(procData.data.items)) {
          items = procData.data.items
          total = procData.data.total || items.length
        } else if (procData.data && Array.isArray(procData.data)) {
          items = procData.data
          total = procData.total || items.length
        } else if (procData.resposta && Array.isArray(procData.resposta.items)) {
          items = procData.resposta.items
          total = procData.resposta.total || items.length
        } else if (procData.resposta && Array.isArray(procData.resposta)) {
          items = procData.resposta
          total = items.length
        } else if (Array.isArray(procData)) {
          items = procData
          total = items.length
        }

        items = items.filter(function (item) {
          return item && typeof item === 'object'
        })

        for (let i = 0; i < items.length; i++) {
          const st = String(items[i].status || items[i].situacao || '').toLowerCase()
          if (
            st.indexOf('inativo') >= 0 ||
            st.indexOf('arquiv') >= 0 ||
            st.indexOf('extinto') >= 0 ||
            st.indexOf('baix') >= 0
          ) {
            inativos++
          } else {
            ativos++
          }
        }

        if (items.length === 0) statusConsulta = 'sem_resultados'

        try {
          const resumoRes = $http.send({
            url: baseUrl + '/api/v2/envolvido/resumo?cpf_cnpj=' + cleanCpf,
            method: 'GET',
            headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
            timeout: 15,
          })
          if (resumoRes.statusCode >= 200 && resumoRes.statusCode < 300 && resumoRes.json) {
            resumoData = resumoRes.json
          }
        } catch (_) {}
      }
    } catch (err) {
      statusConsulta = 'erro'
      erroMsg = 'Erro ao conectar com a API Escavador. Tente novamente.'
    }

    try {
      const consultaCol = $app.findCollectionByNameOrId('candidato_consultas_juridicas')
      const record = new Record(consultaCol)
      record.set('candidato_id', candidateId)
      record.set('cpf_consultado', cleanCpf)
      record.set('nome_consultado', nome)
      record.set('provider', 'escavador')
      record.set('status_consulta', statusConsulta)
      record.set('total_processos', total)
      record.set('total_processos_ativos', ativos)
      record.set('total_processos_inativos', inativos)
      record.set('resumo_json', resumoData || {})
      record.set('estatisticas_json', null)
      record.set('processos_json', items)
      record.set('consultado_por', userId)
      record.set('erro', erroMsg)
      $app.saveNoValidate(record)
    } catch (saveErr) {}

    if (statusConsulta === 'sucesso') {
      try {
        const custoRecords = $app.findRecordsByFilter('custos_consultas', '', '', 1, 0)
        if (custoRecords.length > 0) {
          const custo = Number(custoRecords[0].get('consulta_juridica') || 0)
          if (custo > 0) {
            const currentCost = Number(candidate.get('custo_consultas') || 0)
            candidate.set('custo_consultas', currentCost + custo)
            $app.saveNoValidate(candidate)
          }
        }
      } catch (costErr) {
        $app
          .logger()
          .warn('Erro ao incrementar custo de consulta juridica', 'error', String(costErr))
      }
    }

    if (statusConsulta === 'erro') {
      return e.json(500, {
        success: false,
        error: erroMsg,
        cpf_consultado: cleanCpf,
        nome_consultado: nome,
      })
    }

    return e.json(200, {
      success: true,
      status: statusConsulta,
      cpf_consultado: cleanCpf,
      nome_consultado: nome,
      total_processos: total,
      total_processos_ativos: ativos,
      total_processos_inativos: inativos,
      resumo: resumoData,
      processos: items,
    })
  },
  $apis.requireAuth(),
)
