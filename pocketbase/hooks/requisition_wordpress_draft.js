var safeString = function (value) {
  if (value === null || typeof value === 'undefined') return ''
  return String(value)
}

var constantTimeEqual = function (left, right) {
  left = safeString(left).toLowerCase()
  right = safeString(right).toLowerCase()
  var difference = left.length === right.length ? 0 : 1
  var length = left.length > right.length ? left.length : right.length
  for (var index = 0; index < length; index++) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0)
  }
  return difference === 0
}

var normalizeProtectedCriteriaText = function (value) {
  return safeString(value)
    .toLowerCase()
    .replace(/[áàâãäå]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[íìîï]/g, 'i')
    .replace(/[óòôõö]/g, 'o')
    .replace(/[úùûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[ñ]/g, 'n')
    .replace(/\s+/g, ' ')
    .trim()
}

var protectedCriteriaPatterns = [
  {
    category: 'age',
    pattern:
      /\b(?:(?:ter\s+)?(?:ate|acima de|mais de|menos de)\s+[1-9]\d?\s+anos|(?:idade|faixa etaria)\s+(?:maxima|minima|entre|de|ate)|(?:maior|menor) de [1-9]\d? anos|entre [1-9]\d? e [1-9]\d? anos)\b/,
  },
  {
    category: 'gender_sex',
    pattern:
      /\b(?:(?:sexo|genero)\s+(?:masculin[oa]|feminin[oa])|(?:apenas|somente|preferencia (?:por|de))\s+(?:homens?|mulheres?|masculin[oa]|feminin[oa]))\b/,
  },
  {
    category: 'marital_status',
    pattern:
      /\b(?:(?:estado civil|marital status)\s+(?:solteir[oa]|casad[oa]|divorciad[oa]|viuv[oa])|(?:ser|apenas|somente)\s+(?:solteir[oa]|casad[oa]|divorciad[oa]|viuv[oa]))\b/,
  },
  {
    category: 'religion',
    pattern:
      /\b(?:(?:religiao|preferencia religiosa)\s+(?:catolic[oa]|evangelic[oa]|crista[oa]|ateu|ateia)|(?:ser|apenas|somente)\s+(?:catolic[oa]|evangelic[oa]|crista[oa]|ateu|ateia))\b/,
  },
  {
    category: 'health_disability',
    pattern:
      /\b(?:saude perfeita|boa saude|sem (?:deficiencia|problemas? de saude)|ausencia de deficiencia|nao (?:ter|possuir|apresentar) (?:deficiencia|problemas? de saude))\b/,
  },
  {
    category: 'address_neighborhood',
    pattern:
      /\b(?:(?:residir|morar|ser residente)\s+(?:no|na|em|proximo|proxima|perto)|(?:endereco|bairro|neighborhood|cep)\s+(?:obrigatorio|especifico|exigido))\b/,
  },
  {
    category: 'race_ethnicity',
    pattern:
      /\b(?:(?:raca|etnia|ethnicity|cor da pele)\s+(?:negr[oa]|branc[oa]|pard[oa]|indigena)|preferencia (?:por|de)\s+(?:raca|etnia|negr[oa]s?|branc[oa]s?|pard[oa]s?|indigenas?))\b/,
  },
  {
    category: 'sexual_orientation',
    pattern:
      /\b(?:(?:orientacao sexual|sexual orientation)\s+(?:heterossexual|homossexual|bissexual|gay|lesbica)|(?:ser|apenas|somente)\s+(?:heterossexual|homossexual|bissexual|gay|lesbica))\b/,
  },
  {
    category: 'pregnancy',
    pattern: /\b(?:nao (?:estar|ser)\s+(?:gravid[ao]|gestante)|sem gravidez)\b/,
  },
  {
    category: 'appearance_photo',
    pattern:
      /\b(?:boa aparencia|aparencia (?:obrigatoria|impecavel)|(?:exigir|enviar|anexar)\s+(?:foto|photo|fotografia)|(?:foto|photo|fotografia)\s+recente)\b/,
  },
  {
    category: 'children_dependents_family_status',
    pattern:
      /\b(?:sem (?:filh[oa]s?|dependentes?|children|dependents?)|nao (?:ter|possuir)\s+(?:filh[oa]s?|dependentes?|children|dependents?)|(?:situacao familiar|estado familiar|family status)\s+(?:estavel|especific[oa]))\b/,
  },
]

var findProtectedCriterion = function (reviewedFields) {
  var fields = ['titulo_publico', 'descricao_publica', 'perfil_interno_triagem']
  for (var fieldIndex = 0; fieldIndex < fields.length; fieldIndex++) {
    var field = fields[fieldIndex]
    var normalized = normalizeProtectedCriteriaText(reviewedFields[field])
    for (var patternIndex = 0; patternIndex < protectedCriteriaPatterns.length; patternIndex++) {
      var protectedPattern = protectedCriteriaPatterns[patternIndex]
      if (protectedPattern.pattern.test(normalized)) {
        return { field: field, category: protectedPattern.category }
      }
    }
  }
  return null
}

var resolveCanonicalActor = function (e) {
  var authId = e && e.auth ? safeString(e.auth.id).trim() : ''
  if (!authId) return { ok: false, message: 'Autenticação de usuário inválida.' }

  var collectionMetadataAvailable = false
  var authCollectionName = ''
  try {
    if (typeof e.auth.collection === 'function') {
      collectionMetadataAvailable = true
      var authCollection = e.auth.collection()
      authCollectionName = authCollection ? safeString(authCollection.name).trim() : ''
    } else if (typeof e.auth.collectionName !== 'undefined') {
      collectionMetadataAvailable = true
      authCollectionName = safeString(e.auth.collectionName).trim()
    }
  } catch (_) {
    return { ok: false, message: 'Não foi possível validar a coleção da autenticação.' }
  }

  if (collectionMetadataAvailable && authCollectionName !== 'users') {
    return { ok: false, message: 'A autenticação não pertence à coleção de usuários.' }
  }

  try {
    var canonicalUser = $app.findRecordById('users', authId)
    if (!canonicalUser || safeString(canonicalUser.id) !== authId) {
      return { ok: false, message: 'Usuário autenticado não encontrado.' }
    }
    return { ok: true, id: authId, user: canonicalUser }
  } catch (_) {
    return { ok: false, message: 'Usuário autenticado não encontrado.' }
  }
}

var authorizeRhOrAdmin = function (e) {
  var actorResult = resolveCanonicalActor(e)
  if (!actorResult.ok) return actorResult

  var canonicalUser = actorResult.user
  var userProfile = safeString(canonicalUser.getString('profile')).trim()
  var isAdmin = userProfile === 'admin' || userProfile === 'superadmin'
  var isRH = false
  var departmentId = safeString(canonicalUser.getString('departamento')).trim()
  if (departmentId) {
    try {
      var department = $app.findRecordById('departamentos', departmentId)
      isRH = safeString(department.getString('nome')).trim().toLowerCase() === 'rh'
    } catch (_) {
      isRH = false
    }
  }

  if (!isAdmin && !isRH) {
    return { ok: false, message: 'Apenas RH ou administradores podem realizar esta ação.' }
  }

  actorResult.profile = isAdmin
    ? userProfile === 'superadmin'
      ? 'superadmin'
      : 'admin'
    : 'rh'
  return actorResult
}

var resolveRelationName = function (collectionName, relationId, nameField, appContext) {
  if (!relationId) return ''
  try {
    var relation = (appContext || $app).findRecordById(collectionName, relationId)
    return relation ? safeString(relation.getString(nameField || 'nome')) : ''
  } catch (_) {
    return ''
  }
}

var buildSourceSnapshot = function (requisition, appContext) {
  var cargoId = safeString(requisition.getString('cargo'))
  var clienteId = safeString(requisition.getString('cliente'))
  var cidadeId = safeString(requisition.getString('cidade'))
  var tipoVagaId = safeString(requisition.getString('tipo_vaga'))
  var tipoContratoId = safeString(requisition.getString('tipo_contrato'))
  var departamentoId = safeString(requisition.getString('departamento'))
  var solicitanteId = safeString(requisition.getString('solicitante'))

  return {
    schema_version: 'pmais_gv_requisition_source_v1',
    requisition_id: safeString(requisition.id),
    updated: safeString(requisition.getString('updated')),
    status: safeString(requisition.getString('status')),
    numero_oe: safeString(requisition.getString('numero_oe')),
    quantidade_vagas: requisition.getInt('quantidade_vagas'),
    prioridade: safeString(requisition.getString('prioridade')),
    prazo_desejado: safeString(requisition.getString('prazo_desejado')),
    faixa_salarial: safeString(requisition.getString('faixa_salarial')),
    jornada: safeString(requisition.getString('jornada')),
    horario: safeString(requisition.getString('horario')),
    escala: safeString(requisition.getString('escala')),
    remuneracao: safeString(requisition.getString('remuneracao')),
    beneficios: safeString(requisition.getString('beneficios')),
    requisitos: safeString(requisition.getString('requisitos')),
    escolaridade: safeString(requisition.getString('escolaridade')),
    experiencia: safeString(requisition.getString('experiencia')),
    especificacoes: safeString(requisition.getString('especificacoes')),
    justificativa: safeString(requisition.getString('justificativa')),
    observacoes_internas: safeString(requisition.getString('observacoes_internas')),
    relations: {
      cargo: { id: cargoId, nome: resolveRelationName('cargos', cargoId, 'nome', appContext) },
      cliente: {
        id: clienteId,
        nome: resolveRelationName('clientes', clienteId, 'nome', appContext),
      },
      cidade: { id: cidadeId, nome: resolveRelationName('cidades', cidadeId, 'nome', appContext) },
      tipo_vaga: {
        id: tipoVagaId,
        nome: resolveRelationName('tipos_vaga', tipoVagaId, 'nome', appContext),
      },
      tipo_contrato: {
        id: tipoContratoId,
        nome: resolveRelationName('tipos_contrato', tipoContratoId, 'nome', appContext),
      },
      departamento: {
        id: departamentoId,
        nome: resolveRelationName('departamentos', departamentoId, 'nome', appContext),
      },
      solicitante: {
        id: solicitanteId,
        nome: resolveRelationName('users', solicitanteId, 'name', appContext),
      },
    },
  }
}

var sourceFingerprint = function (snapshot) {
  return $security.sha256(JSON.stringify(snapshot))
}

var readJsonResponse = function (response) {
  if (!response) return null
  if (response.json && typeof response.json === 'object') return response.json
  if (!response.body) return null
  try {
    return JSON.parse(new TextDecoder().decode(response.body))
  } catch (_) {
    return null
  }
}

var logHookError = function (scope, requisitionId, error) {
  try {
    $app.logger().error(
      scope,
      'requisition_id',
      requisitionId,
      'error',
      safeString((error && error.message) || error || 'unknown').substring(0, 500),
    )
  } catch (_) {}
}

routerAdd(
  'POST',
  '/backend/v1/requisitions/{id}/wordpress-draft',
  (e) => {
    var previewGate = safeString($secrets.get('PMAIS_WORDPRESS_DRAFT_ENABLED') || '')
    if (previewGate !== 'true') {
      return e.json(503, {
        ok: false,
        message: 'A criação de rascunho no WordPress está desabilitada neste ambiente.',
      })
    }

    var id = e.request.pathValue('id')
    if (!id) return e.badRequestError('ID da requisição é obrigatório')

    var actor = authorizeRhOrAdmin(e)
    if (!actor.ok) return e.forbiddenError(actor.message)

    var requisition = null
    try {
      requisition = $app.findRecordById('requisitions', id)
    } catch (_) {
      return e.notFoundError('Requisição não encontrada')
    }
    if (requisition.getString('status') !== 'Aprovada') {
      return e.badRequestError('Apenas requisições aprovadas podem criar vaga no WordPress')
    }

    var requestBody = {}
    try {
      requestBody = e.requestInfo().body || {}
      if (typeof requestBody === 'string') requestBody = JSON.parse(requestBody || '{}')
    } catch (_) {
      return e.json(400, { ok: false, message: 'Corpo da solicitação inválido.' })
    }

    var irisPublication = requestBody.publicacao_iris || {}
    var publicTitle = safeString(irisPublication.titulo_publico_iris).trim()
    var publicDescription = safeString(irisPublication.descricao_publica_iris).trim()
    var internalProfile = safeString(irisPublication.perfil_interno_triagem_iris).trim()
    var proof = irisPublication.suggestion_proof || {}

    if (!publicTitle || !publicDescription || !internalProfile) {
      return e.json(400, {
        ok: false,
        message:
          'Gere e revise título, descrição pública e perfil interno com a Íris antes de criar o rascunho.',
      })
    }
    if (publicTitle.length > 160) {
      return e.json(422, { ok: false, message: 'O título público deve ter no máximo 160 caracteres.' })
    }
    if (publicDescription.length > 10000) {
      return e.json(422, {
        ok: false,
        message: 'A descrição pública deve ter no máximo 10.000 caracteres.',
      })
    }
    if (internalProfile.length > 8000) {
      return e.json(422, {
        ok: false,
        message: 'O perfil interno deve ter no máximo 8.000 caracteres.',
      })
    }

    var proofSecret = safeString($secrets.get('PMAIS_IRIS_GV_PROOF_SECRET') || '').trim()
    if (!proofSecret) {
      return e.json(503, { ok: false, message: 'Validação da sugestão da Íris não configurada.' })
    }

    var proofRequestId = safeString(proof.request_id).trim()
    var proofVersion = safeString(proof.second_brain_version).trim()
    var proofSecondBrainSha256 = safeString(proof.second_brain_sha256).trim().toLowerCase()
    var proofSourceFingerprint = safeString(proof.source_fingerprint).trim().toLowerCase()
    var proofExpiresAt = parseInt(proof.expires_at || 0, 10)
    var proofSignature = safeString(proof.signature).trim().toLowerCase()
    var nowSeconds = Math.floor(Date.now() / 1000)
    var sha256Pattern = /^[a-f0-9]{64}$/
    if (
      !proofRequestId ||
      !proofVersion ||
      !sha256Pattern.test(proofSecondBrainSha256) ||
      !sha256Pattern.test(proofSourceFingerprint) ||
      !proofSignature ||
      !proofExpiresAt ||
      proofExpiresAt < nowSeconds ||
      proofExpiresAt > nowSeconds + 1800
    ) {
      return e.json(400, {
        ok: false,
        message: 'A sugestão da Íris está ausente ou expirada. Gere uma nova sugestão.',
      })
    }

    var currentSnapshot = buildSourceSnapshot(requisition)
    var currentSourceFingerprint = sourceFingerprint(currentSnapshot).toLowerCase()
    if (!constantTimeEqual(currentSourceFingerprint, proofSourceFingerprint)) {
      return e.json(409, {
        ok: false,
        stale: true,
        message: 'A requisição foi alterada após a sugestão. Gere uma nova sugestão da Íris.',
      })
    }

    var proofCanonical =
      id +
      '\n' +
      actor.id +
      '\n' +
      proofRequestId +
      '\n' +
      proofVersion +
      '\n' +
      proofSecondBrainSha256 +
      '\n' +
      proofSourceFingerprint +
      '\n' +
      String(proofExpiresAt)
    var expectedProof = $security.hs256(proofCanonical, proofSecret)
    if (!constantTimeEqual(expectedProof, proofSignature)) {
      return e.json(403, {
        ok: false,
        message: 'A comprovação da sugestão da Íris é inválida. Gere uma nova sugestão.',
      })
    }

    var approvedWpHost = 'pmaisservicos.com.br'
    var approvedWpPath = '/wp-json/pmais-skip/v1/requisicoes/vagas'
    var approvedWpUrl = 'https://' + approvedWpHost + approvedWpPath
    var wpUrl = safeString($secrets.get('PMAIS_WORDPRESS_DRAFT_URL') || '').trim()
    if (!wpUrl || wpUrl !== approvedWpUrl) {
      return e.json(503, {
        ok: false,
        message: 'URL segura do WordPress não configurada para o destino aprovado.',
      })
    }

    var token = safeString($secrets.get('WORDPRESS_INTEGRATION_TOKEN') || '').trim()
    if (!token) {
      return e.json(503, { ok: false, message: 'Token de integração não configurado.' })
    }

    var reviewedFieldHashes = {
      titulo_sha256: $security.sha256(publicTitle),
      descricao_publica_sha256: $security.sha256(publicDescription),
      perfil_interno_sha256: $security.sha256(internalProfile),
    }
    var payload = {
      requisition_id: id,
      versao: 1,
      oe: currentSnapshot.numero_oe,
      titulo: publicTitle,
      quantidade: currentSnapshot.quantidade_vagas,
      cliente_unidade: currentSnapshot.relations.cliente.nome,
      publico: {
        localizacao: currentSnapshot.relations.cidade.nome,
        descricao: publicDescription,
        jornada: currentSnapshot.jornada,
        horario: currentSnapshot.horario,
        escala: currentSnapshot.escala,
        remuneracao: currentSnapshot.remuneracao,
        beneficios: currentSnapshot.beneficios,
        requisitos_obrigatorios: currentSnapshot.requisitos,
        escolaridade: currentSnapshot.escolaridade,
        experiencia: currentSnapshot.experiencia,
      },
      interno: {
        perfil_triagem: internalProfile,
        observacoes: currentSnapshot.observacoes_internas,
      },
      tipo_vaga: currentSnapshot.relations.tipo_vaga.nome,
      tipo_contrato: currentSnapshot.relations.tipo_contrato.nome,
      prazo_desejado: currentSnapshot.prazo_desejado,
      prioridade: currentSnapshot.prioridade,
      faixa_salarial: currentSnapshot.faixa_salarial,
      especificacoes: publicDescription,
      justificativa: currentSnapshot.justificativa,
      jornada: currentSnapshot.jornada,
      horario: currentSnapshot.horario,
      escala: currentSnapshot.escala,
      remuneracao: currentSnapshot.remuneracao,
      beneficios: currentSnapshot.beneficios,
      requisitos: currentSnapshot.requisitos,
      escolaridade: currentSnapshot.escolaridade,
      experiencia: currentSnapshot.experiencia,
      departamento: currentSnapshot.relations.departamento.nome,
      solicitante: currentSnapshot.relations.solicitante.nome,
      source_fingerprint: currentSourceFingerprint,
      reviewed_field_hashes: reviewedFieldHashes,
    }

    var missingFields = []
    if (!payload.oe) missingFields.push('oe')
    if (!payload.quantidade || payload.quantidade <= 0) missingFields.push('quantidade')
    if (!currentSnapshot.relations.cargo.nome) missingFields.push('cargo')
    if (missingFields.length > 0) {
      return e.json(400, {
        ok: false,
        message: 'Campos obrigatórios ausentes ou inválidos: ' + missingFields.join(', '),
        missing_fields: missingFields,
      })
    }

    var protectedCriterion = findProtectedCriterion({
      titulo_publico: publicTitle,
      descricao_publica: publicDescription,
      perfil_interno_triagem: internalProfile,
    })
    if (protectedCriterion) {
      return e.json(422, {
        ok: false,
        code: 'IRIS_REVIEWED_CONTENT_PROTECTED_CRITERIA',
        field: protectedCriterion.field,
        category: protectedCriterion.category,
        message:
          'O conteúdo revisado contém critério pessoal, protegido ou discriminatório e não pode ser enviado ao WordPress.',
      })
    }

    var wordpressResponse = null
    try {
      wordpressResponse = $http.send({
        url: wpUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: 'Bearer ' + token,
          'User-Agent': 'PMais-GV-Integration/1.0',
        },
        body: JSON.stringify(payload),
        timeout: 30,
      })
    } catch (error) {
      logHookError('wordpress-draft: network failure', id, error)
      return e.json(502, {
        ok: false,
        message: 'Falha de rede ao contactar o WordPress. Nenhuma alteração local foi salva.',
      })
    }

    var statusCode = (wordpressResponse && wordpressResponse.statusCode) || 0
    var wordpressPayload = readJsonResponse(wordpressResponse)
    if (statusCode !== 200 && statusCode !== 201) {
      logHookError('wordpress-draft: WordPress rejected request (' + statusCode + ')', id, '')
      return e.json(statusCode >= 400 && statusCode < 500 ? statusCode : 502, {
        ok: false,
        message: 'O WordPress recusou a criação do rascunho (HTTP ' + statusCode + ').',
      })
    }

    var responseHashes = wordpressPayload ? wordpressPayload.verification_hashes || {} : {}
    var verifiedExactly =
      wordpressPayload &&
      wordpressPayload.verified === true &&
      wordpressPayload.post_status === 'draft' &&
      constantTimeEqual(responseHashes.titulo_sha256, reviewedFieldHashes.titulo_sha256) &&
      constantTimeEqual(
        responseHashes.descricao_publica_sha256,
        reviewedFieldHashes.descricao_publica_sha256,
      ) &&
      constantTimeEqual(
        responseHashes.perfil_interno_sha256,
        reviewedFieldHashes.perfil_interno_sha256,
      )
    if (!verifiedExactly) {
      logHookError('wordpress-draft: response integrity verification failed', id, '')
      return e.json(502, {
        ok: false,
        message: 'O WordPress não comprovou a integridade exata do rascunho. Nada foi salvo localmente.',
      })
    }

    var isDuplicate = wordpressPayload.duplicate === true
    if ((statusCode === 200 && !isDuplicate) || (statusCode === 201 && isDuplicate)) {
      return e.json(502, {
        ok: false,
        message: 'A resposta de criação/duplicidade do WordPress é inconsistente.',
      })
    }

    var wpJobId = safeString(wordpressPayload.wordpress_job_id).trim()
    var wpAdminUrl = safeString(wordpressPayload.wordpress_admin_url).trim()
    if (!wpJobId) {
      return e.json(502, {
        ok: false,
        message: 'O WordPress não retornou o identificador do rascunho verificado.',
      })
    }

    var auditObservation = JSON.stringify({
      schema_version: 'pmais_gv_wordpress_draft_audit_v1',
      proof_request_id: proofRequestId,
      second_brain_version: proofVersion,
      second_brain_sha256: proofSecondBrainSha256,
      source_fingerprint: currentSourceFingerprint,
      reviewed_field_hashes: reviewedFieldHashes,
    })

    try {
      $app.runInTransaction((txApp) => {
        var successRecord = txApp.findRecordById('requisitions', id)
        if (successRecord.getString('status') !== 'Aprovada') {
          throw new Error('A requisição mudou de status antes da confirmação local.')
        }
        var transactionFingerprint = sourceFingerprint(
          buildSourceSnapshot(successRecord, txApp),
        ).toLowerCase()
        if (!constantTimeEqual(transactionFingerprint, currentSourceFingerprint)) {
          throw new Error('A requisição foi alterada antes da confirmação local.')
        }

        successRecord.set('wordpress_sync_status', 'sucesso')
        successRecord.set('wordpress_sync_date', new Date().toISOString().split('T')[0])
        successRecord.set('wordpress_error_message', '')
        successRecord.set('wordpress_job_id', wpJobId)
        successRecord.set('wordpress_admin_url', wpAdminUrl)
        successRecord.set('status', 'Rascunho criado no WordPress')

        var historyCollection = txApp.findCollectionByNameOrId('requisition_history')
        var historyRecord = new Record(historyCollection)
        historyRecord.set('requisition_id', id)
        historyRecord.set('usuario_id', actor.id)
        historyRecord.set('status_anterior', 'Aprovada')
        historyRecord.set('status_novo', 'Rascunho criado no WordPress')
        historyRecord.set('acao', 'Rascunho criado no WordPress')
        historyRecord.set('observacao', auditObservation)

        txApp.save(successRecord)
        txApp.save(historyRecord)
      })
    } catch (transactionError) {
      logHookError('wordpress-draft: atomic local persistence failed', id, transactionError)
      return e.json(500, {
        ok: false,
        retryable: true,
        message:
          'O rascunho foi confirmado pelo WordPress, mas o registro local atômico falhou. Tente novamente.',
      })
    }

    return e.json(200, {
      ok: true,
      duplicate: isDuplicate,
      verified: true,
      post_status: 'draft',
      wordpress_job_id: wpJobId,
      wordpress_admin_url: wpAdminUrl,
    })
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/iris/requisitions/{id}/job-description',
  (e) => {
    var id = e.request.pathValue('id')
    if (!id) return e.badRequestError('ID da requisição é obrigatório')

    var actor = authorizeRhOrAdmin(e)
    if (!actor.ok) return e.forbiddenError(actor.message)

    var requisition = null
    try {
      requisition = $app.findRecordById('requisitions', id)
    } catch (_) {
      return e.notFoundError('Requisição não encontrada')
    }
    if (requisition.getString('status') !== 'Aprovada') {
      return e.badRequestError('Apenas requisições aprovadas podem ser analisadas pela Íris')
    }

    var snapshot = buildSourceSnapshot(requisition)
    var currentSourceFingerprint = sourceFingerprint(snapshot).toLowerCase()
    var examples = []
    try {
      var records = $app.findRecordsByFilter(
        'vacancies',
        'wordpress_job_id != ""',
        '-created',
        5,
        0,
      )
      for (var index = 0; index < records.length; index++) {
        var vacancy = records[index]
        var vacancyCargoId = safeString(vacancy.getString('cargo'))
        var vacancyCidadeId = safeString(vacancy.getString('cidade'))
        examples.push({
          cargo: resolveRelationName('cargos', vacancyCargoId),
          cidade: resolveRelationName('cidades', vacancyCidadeId),
          especificacoes: safeString(vacancy.getString('especificacoes')).substring(0, 500),
          requisitos: safeString(vacancy.getString('requisitos')).substring(0, 500),
        })
      }
    } catch (_) {}

    var gatewayUrl = safeString($secrets.get('PMAIS_IRIS_GV_URL') || '').trim()
    var gatewayApiKey = safeString($secrets.get('PMAIS_IRIS_GV_API_KEY') || '').trim()
    var gatewayHmacSecret = safeString($secrets.get('PMAIS_IRIS_GV_HMAC_SECRET') || '').trim()
    var proofSecret = safeString($secrets.get('PMAIS_IRIS_GV_PROOF_SECRET') || '').trim()
    if (!gatewayUrl || !gatewayApiKey || !gatewayHmacSecret || !proofSecret) {
      return e.json(503, {
        ok: false,
        message: 'Integração segura com a Íris não configurada para este ambiente.',
      })
    }

    var requestId = 'irisgv-' + id + '-' + String(Date.now())
    var envelope = {
      schema_version: 'pmais_iris_gv_rh_job_description_request_v1',
      operation: 'generate_job_description_package',
      request_id: requestId,
      requisition_id: id,
      actor_id: actor.id,
      actor_profile: actor.profile,
      requisition_status: 'Aprovada',
      source_fingerprint: currentSourceFingerprint,
      context: {
        cargo: snapshot.relations.cargo.nome,
        cliente: snapshot.relations.cliente.nome,
        cidade: snapshot.relations.cidade.nome,
        tipo_vaga: snapshot.relations.tipo_vaga.nome,
        tipo_contrato: snapshot.relations.tipo_contrato.nome,
        departamento: snapshot.relations.departamento.nome,
        quantidade_vagas: snapshot.quantidade_vagas,
        prioridade: snapshot.prioridade,
        prazo_desejado: snapshot.prazo_desejado,
        faixa_salarial: snapshot.faixa_salarial,
        jornada: snapshot.jornada,
        horario: snapshot.horario,
        escala: snapshot.escala,
        remuneracao: snapshot.remuneracao,
        beneficios: snapshot.beneficios,
        requisitos: snapshot.requisitos,
        escolaridade: snapshot.escolaridade,
        experiencia: snapshot.experiencia,
        especificacoes: snapshot.especificacoes,
        justificativa: snapshot.justificativa,
        observacoes_internas: snapshot.observacoes_internas,
        exemplos_wordpress: examples,
      },
    }
    var envelopeBody = JSON.stringify(envelope)
    var timestamp = String(Math.floor(Date.now() / 1000))
    var signature = $security.hs256(timestamp + '.' + envelopeBody, gatewayHmacSecret)
    var gatewayResponse = null
    try {
      gatewayResponse = $http.send({
        url: gatewayUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-PMais-API-Key': gatewayApiKey,
          'X-PMais-Timestamp': timestamp,
          'X-PMais-Signature': signature,
        },
        body: envelopeBody,
        timeout: 120,
      })
    } catch (error) {
      logHookError('iris-gv: gateway network failure', id, error)
      return e.json(502, {
        ok: false,
        message: 'A Íris não respondeu. Nenhum rascunho foi criado.',
      })
    }

    var gatewayStatus = (gatewayResponse && gatewayResponse.statusCode) || 0
    var gatewayPayload = readJsonResponse(gatewayResponse)
    if (gatewayStatus !== 200 || !gatewayPayload) {
      return e.json(502, {
        ok: false,
        message: 'A Íris não conseguiu gerar a sugestão. Nenhum rascunho foi criado.',
      })
    }

    var title = safeString(gatewayPayload.titulo_publico).trim()
    var publicText = safeString(
      gatewayPayload.texto_wordpress || gatewayPayload.descricao_publica,
    ).trim()
    var internalProfile = safeString(gatewayPayload.perfil_interno_triagem).trim()
    var audit = gatewayPayload.audit || {}
    var secondBrainVersion = safeString(audit.second_brain_version).trim()
    var secondBrainSha256 = safeString(audit.second_brain_sha256).trim().toLowerCase()
    var responseSourceFingerprint = safeString(audit.source_fingerprint).trim()
    var responseSchema = 'pmais_iris_gv_rh_job_description_response_v1'
    var responseOperation = 'generate_job_description_package'
    if (
      gatewayPayload.ok !== true ||
      gatewayPayload.schema_version !== responseSchema ||
      gatewayPayload.operation !== responseOperation ||
      gatewayPayload.agent !== 'iris' ||
      gatewayPayload.fallback !== false ||
      !title ||
      !publicText ||
      !internalProfile ||
      title.length > 160 ||
      publicText.length > 10000 ||
      internalProfile.length > 8000 ||
      !secondBrainVersion ||
      !/^[a-f0-9]{64}$/.test(secondBrainSha256) ||
      !/^[a-f0-9]{64}$/.test(responseSourceFingerprint) ||
      !constantTimeEqual(responseSourceFingerprint, currentSourceFingerprint) ||
      safeString(audit.request_id) !== requestId ||
      safeString(audit.requisition_id) !== id
    ) {
      return e.json(502, {
        ok: false,
        message: 'A resposta da Íris não passou pela validação. Nenhum rascunho foi criado.',
      })
    }

    var expiresAt = Math.floor(Date.now() / 1000) + 1800
    var proofCanonical =
      id +
      '\n' +
      actor.id +
      '\n' +
      requestId +
      '\n' +
      secondBrainVersion +
      '\n' +
      secondBrainSha256 +
      '\n' +
      currentSourceFingerprint +
      '\n' +
      String(expiresAt)

    return e.json(200, {
      ok: true,
      schema_version: responseSchema,
      operation: responseOperation,
      agent: 'iris',
      fallback: false,
      titulo_publico: title,
      descricao_publica: publicText,
      texto_wordpress: publicText,
      perfil_interno_triagem: internalProfile,
      audit: audit,
      suggestion_proof: {
        request_id: requestId,
        second_brain_version: secondBrainVersion,
        second_brain_sha256: secondBrainSha256,
        source_fingerprint: currentSourceFingerprint,
        expires_at: expiresAt,
        signature: $security.hs256(proofCanonical, proofSecret),
      },
    })
  },
  $apis.requireAuth(),
)
