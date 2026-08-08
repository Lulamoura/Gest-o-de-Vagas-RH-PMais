routerAdd(
  'POST',
  '/backend/v1/reconcile-vacancy',
  (e) => {
    var profile = e.auth ? e.auth.getString('profile') : ''
    if (!e.auth || (profile !== 'admin' && profile !== 'superadmin'))
      return e.forbiddenError('Apenas administradores podem executar reconciliação')

    var body = e.requestInfo().body || {}
    var vacId = body.vacancy_id || ''
    var reqId = body.requisition_id || ''
    var wpJobId = body.wordpress_job_id || ''
    if (!vacId || !reqId || !wpJobId)
      return e.badRequestError('vacancy_id, requisition_id e wordpress_job_id são obrigatórios')

    var resolveName = function (col, id) {
      if (!id) return ''
      try {
        return $app.findRecordById(col, id).getString('nome')
      } catch (_) {
        return id
      }
    }

    var serializeVacancy = function (v) {
      if (!v) return null
      var s = function (f) {
        return v.getString(f)
      }
      return {
        id: v.id,
        wordpress_job_id: s('wordpress_job_id'),
        cliente: resolveName('clientes', s('cliente')),
        cargo: resolveName('cargos', s('cargo')),
        cidade: resolveName('cidades', s('cidade')),
        tipo_vaga: resolveName('tipos_vaga', s('tipo_vaga')),
        tipo_contrato: resolveName('tipos_contrato', s('tipo_contrato')),
        quantidade_vagas: v.getInt('quantidade_vagas'),
        salario_faixa: s('salario_faixa'),
        prioridade: s('prioridade'),
        especificacoes: s('especificacoes'),
        observacoes_internas: s('observacoes_internas'),
        perfil_interno: s('perfil_interno'),
        responsavel_operacional: s('responsavel_operacional'),
        ordem_execucao: s('ordem_execucao'),
        prazo_desejado: s('prazo_desejado'),
        data_abertura: s('data_abertura'),
        link_publico: s('link_publico'),
        origem: s('origem'),
        status_vaga: s('status_vaga'),
        updated: s('updated'),
      }
    }

    var serializeReq = function (r) {
      if (!r) return null
      return {
        id: r.id,
        status: r.getString('status'),
        wordpress_job_id: r.getString('wordpress_job_id'),
        wordpress_sync_status: r.getString('wordpress_sync_status'),
        wordpress_sync_date: r.getString('wordpress_sync_date'),
        link_publico: r.getString('link_publico'),
        data_publicacao: r.getString('data_publicacao'),
      }
    }

    var readV = function (id) {
      try {
        return $app.findRecordById('vacancies', id)
      } catch (_) {
        return null
      }
    }
    var readR = function (id) {
      try {
        return $app.findRecordById('requisitions', id)
      } catch (_) {
        return null
      }
    }
    var countByJob = function (jid) {
      try {
        return $app.findRecordsByFilter(
          'vacancies',
          'wordpress_job_id = {:jid}',
          '-created',
          0,
          0,
          jid,
        ).length
      } catch (_) {
        return 0
      }
    }

    var preVac = readV(vacId)
    var preReq = readR(reqId)
    if (!preVac) return e.json(404, { ok: false, error: 'Vaga não encontrada: ' + vacId })
    if (!preReq) return e.json(404, { ok: false, error: 'Requisição não encontrada: ' + reqId })

    var preSnapshot = {
      vacancy: serializeVacancy(preVac),
      vacancy_count: countByJob(wpJobId),
      requisition: serializeReq(preReq),
    }

    var payload = {
      wordpress_job_id: wpJobId,
      requisition_id: reqId,
      origem: preVac.getString('origem') || 'wordpress',
    }
    var da = preVac.getString('data_abertura')
    if (da) payload.data_publicacao = da
    var lp = preVac.getString('link_publico')
    if (lp) payload.link_publico = lp

    var token = $secrets.get('WORDPRESS_INTEGRATION_TOKEN') || ''
    if (!token)
      return e.json(500, {
        ok: false,
        error: 'Token de integração não configurado',
        pre_snapshot: preSnapshot,
      })

    var instUrl = $secrets.get('PB_INSTANCE_URL') || ''
    if (instUrl.endsWith('/')) instUrl = instUrl.slice(0, -1)
    if (!instUrl)
      return e.json(500, {
        ok: false,
        error: 'URL da instância não configurada',
        pre_snapshot: preSnapshot,
      })

    var importStatus = 0,
      importResp = null,
      httpErr = null
    try {
      var res = $http.send({
        url: instUrl + '/backend/v1/vagas/wordpress',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(payload),
        timeout: 30,
      })
      importStatus = res.statusCode || 0
      if (res.body) {
        try {
          importResp = JSON.parse(new TextDecoder().decode(res.body))
        } catch (_) {
          try {
            importResp = res.json || null
          } catch (__) {}
        }
      } else if (res.json) importResp = res.json
    } catch (err) {
      httpErr = String(err)
    }

    if (httpErr)
      return e.json(500, {
        ok: false,
        error: 'Erro na chamada HTTP: ' + httpErr,
        pre_snapshot: preSnapshot,
        post_snapshot: null,
      })

    var postSnapshot = {
      vacancy: serializeVacancy(readV(vacId)),
      vacancy_count: countByJob(wpJobId),
      requisition: serializeReq(readR(reqId)),
    }

    return e.json(200, {
      ok: importStatus >= 200 && importStatus < 300,
      import_status: importStatus,
      import_response: importResp,
      payload: payload,
      pre_snapshot: preSnapshot,
      post_snapshot: postSnapshot,
    })
  },
  $apis.requireAuth(),
)
