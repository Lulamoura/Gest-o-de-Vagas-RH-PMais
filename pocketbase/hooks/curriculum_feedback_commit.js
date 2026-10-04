routerAdd(
  'POST',
  '/backend/v1/curriculum-feedback/commit',
  (e) => {
    var curriculumFeedbackSafeString = function (value) {
      if (value === null || typeof value === 'undefined') return ''
      return String(value)
    }

    var curriculumFeedbackConstantTimeEqual = function (left, right) {
      left = curriculumFeedbackSafeString(left).toLowerCase()
      right = curriculumFeedbackSafeString(right).toLowerCase()
      var difference = left.length === right.length ? 0 : 1
      var length = left.length > right.length ? left.length : right.length
      for (var index = 0; index < length; index++) {
        difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0)
      }
      return difference === 0
    }

    var canonicalizeCurriculumFeedbackValue = function (value) {
      if (Array.isArray(value)) {
        return value.map(function (item) {
          return canonicalizeCurriculumFeedbackValue(item)
        })
      }
      if (value && typeof value === 'object') {
        var normalized = {}
        Object.keys(value)
          .sort()
          .forEach(function (key) {
            normalized[key] = canonicalizeCurriculumFeedbackValue(value[key])
          })
        return normalized
      }
      return value
    }

    var canonicalCurriculumFeedbackJson = function (value) {
      return JSON.stringify(canonicalizeCurriculumFeedbackValue(value))
    }

    var curriculumFeedbackExactKeys = function (value, expected) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false
      var actual = Object.keys(value).sort()
      var wanted = expected.slice().sort()
      return JSON.stringify(actual) === JSON.stringify(wanted)
    }

    var curriculumFeedbackHasWellFormedUtf16 = function (value) {
      if (typeof value !== 'string') return false
      for (var index = 0; index < value.length; index++) {
        var codeUnit = value.charCodeAt(index)
        if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
          if (index + 1 >= value.length) return false
          var nextCodeUnit = value.charCodeAt(index + 1)
          if (nextCodeUnit < 0xdc00 || nextCodeUnit > 0xdfff) return false
          index++
        } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
          return false
        }
      }
      return true
    }

    var curriculumFeedbackTextInRange = function (value, minimum, maximum) {
      if (!curriculumFeedbackHasWellFormedUtf16(value)) return false
      var semanticLength = value.trim().length
      return semanticLength >= minimum && semanticLength <= maximum
    }

    var curriculumFeedbackRawTextAtMost = function (value, maximum) {
      return curriculumFeedbackHasWellFormedUtf16(value) && value.length <= maximum
    }

    var curriculumFeedbackGetOptionalUserField = function (user, field) {
      try {
        return user.get(field)
      } catch (_) {
        return null
      }
    }

    var resolveCurriculumFeedbackActor = function (e) {
      var authId = e && e.auth ? curriculumFeedbackSafeString(e.auth.id) : ''
      if (!/^[A-Za-z0-9_-]{1,160}$/.test(authId)) {
        return { ok: false, code: 'CURRICULUM_FEEDBACK_AUTH_INVALID' }
      }

      var authCollectionKnown = false
      var authCollectionName = ''
      try {
        if (typeof e.auth.collection === 'function') {
          authCollectionKnown = true
          var authCollection = e.auth.collection()
          authCollectionName = authCollection
            ? curriculumFeedbackSafeString(authCollection.name)
            : ''
        } else if (typeof e.auth.collectionName !== 'undefined') {
          authCollectionKnown = true
          authCollectionName = curriculumFeedbackSafeString(e.auth.collectionName)
        }
      } catch (_) {
        return { ok: false, code: 'CURRICULUM_FEEDBACK_AUTH_INVALID' }
      }
      if (authCollectionKnown && authCollectionName !== 'users') {
        return { ok: false, code: 'CURRICULUM_FEEDBACK_AUTH_INVALID' }
      }

      var canonicalUser = null
      try {
        canonicalUser = $app.findRecordById('users', authId)
      } catch (_) {
        return { ok: false, code: 'CURRICULUM_FEEDBACK_AUTH_INVALID' }
      }
      if (!canonicalUser || curriculumFeedbackSafeString(canonicalUser.id) !== authId) {
        return { ok: false, code: 'CURRICULUM_FEEDBACK_AUTH_INVALID' }
      }

      if (
        canonicalUser.getBool('verified') !== true ||
        curriculumFeedbackGetOptionalUserField(canonicalUser, 'disabled') === true
      ) {
        return { ok: false, code: 'CURRICULUM_FEEDBACK_ACTOR_INACTIVE' }
      }
      var activeFields = ['active', 'ativo', 'enabled']
      for (var activeIndex = 0; activeIndex < activeFields.length; activeIndex++) {
        var activeValue = curriculumFeedbackGetOptionalUserField(
          canonicalUser,
          activeFields[activeIndex],
        )
        if (activeValue !== null && typeof activeValue !== 'undefined' && activeValue !== true) {
          return { ok: false, code: 'CURRICULUM_FEEDBACK_ACTOR_INACTIVE' }
        }
      }

      var profile = canonicalUser.getString('profile')
      if (profile === 'admin' || profile === 'superadmin') {
        return { ok: true, id: authId, user: canonicalUser }
      }
      if (profile !== 'operator') {
        return { ok: false, code: 'CURRICULUM_FEEDBACK_ACTOR_FORBIDDEN' }
      }

      var departmentId = canonicalUser.getString('departamento')
      if (!departmentId) {
        return { ok: false, code: 'CURRICULUM_FEEDBACK_ACTOR_FORBIDDEN' }
      }
      try {
        var department = $app.findRecordById('departamentos', departmentId)
        if (department.getString('nome').trim().toLowerCase() !== 'rh') {
          return { ok: false, code: 'CURRICULUM_FEEDBACK_ACTOR_FORBIDDEN' }
        }
      } catch (_) {
        return { ok: false, code: 'CURRICULUM_FEEDBACK_ACTOR_FORBIDDEN' }
      }

      return { ok: true, id: authId, user: canonicalUser }
    }

    var curriculumFeedbackPayloadKeys = [
      'schema_version',
      'operation',
      'vacancy_id',
      'wordpress_job_id',
      'application_id',
      'analysis_id',
      'analysis_version',
      'analysis_agent',
      'interpretation_request_id',
      'interpretation_model',
      'criteria_version',
      'source_fingerprint',
      'perception',
      'understanding',
      'justification',
      'confirmation',
      'complement',
      'actor_id',
      'proof_expires_at',
      'proof_signature',
      'calibration_state',
      'idempotency_key',
    ]

    var curriculumFeedbackImmutableKeys = curriculumFeedbackPayloadKeys.filter(function (key) {
      return key !== 'idempotency_key'
    })

    var curriculumFeedbackImmutablePayload = function (payload) {
      var immutable = {}
      for (var index = 0; index < curriculumFeedbackImmutableKeys.length; index++) {
        var key = curriculumFeedbackImmutableKeys[index]
        immutable[key] = payload[key]
      }
      return immutable
    }

    var validateCurriculumFeedbackPayload = function (payload, actorId, nowSeconds) {
      if (!curriculumFeedbackExactKeys(payload, curriculumFeedbackPayloadKeys)) {
        return { ok: false, status: 400, code: 'CURRICULUM_FEEDBACK_REQUEST_INVALID' }
      }
      if (
        payload.schema_version !== 'pmais_curriculum_feedback_commit_v1' ||
        payload.operation !== 'commit_curriculum_feedback'
      ) {
        return { ok: false, status: 400, code: 'CURRICULUM_FEEDBACK_CONTRACT_INVALID' }
      }
      if (payload.actor_id !== actorId) {
        return { ok: false, status: 403, code: 'CURRICULUM_FEEDBACK_ACTOR_MISMATCH' }
      }
      if (
        typeof payload.vacancy_id !== 'string' ||
        !/^[A-Za-z0-9_-]{1,160}$/.test(payload.vacancy_id) ||
        typeof payload.wordpress_job_id !== 'string' ||
        !/^[1-9][0-9]{0,19}$/.test(payload.wordpress_job_id) ||
        typeof payload.application_id !== 'string' ||
        !/^[1-9][0-9]{0,19}$/.test(payload.application_id) ||
        typeof payload.analysis_id !== 'string' ||
        !/^[A-Za-z0-9._:-]{1,160}$/.test(payload.analysis_id) ||
        typeof payload.interpretation_request_id !== 'string' ||
        !/^[A-Za-z0-9._:-]{1,160}$/.test(payload.interpretation_request_id) ||
        typeof payload.actor_id !== 'string' ||
        !/^[A-Za-z0-9_-]{1,160}$/.test(payload.actor_id)
      ) {
        return { ok: false, status: 422, code: 'CURRICULUM_FEEDBACK_ID_INVALID' }
      }
      if (
        !curriculumFeedbackTextInRange(payload.analysis_version, 1, 80) ||
        payload.analysis_agent !== 'iris' ||
        !curriculumFeedbackTextInRange(payload.interpretation_model, 1, 240) ||
        !curriculumFeedbackTextInRange(payload.criteria_version, 1, 160) ||
        !curriculumFeedbackTextInRange(payload.perception, 3, 4000) ||
        !curriculumFeedbackTextInRange(payload.understanding, 1, 4000) ||
        !curriculumFeedbackTextInRange(payload.justification, 1, 4000) ||
        !curriculumFeedbackRawTextAtMost(payload.complement, 4000)
      ) {
        return { ok: false, status: 422, code: 'CURRICULUM_FEEDBACK_FIELD_INVALID' }
      }
      if (
        typeof payload.source_fingerprint !== 'string' ||
        !/^[a-f0-9]{64}$/.test(payload.source_fingerprint) ||
        typeof payload.proof_signature !== 'string' ||
        !/^[a-f0-9]{64}$/.test(payload.proof_signature) ||
        typeof payload.idempotency_key !== 'string' ||
        !/^[a-f0-9]{64}$/.test(payload.idempotency_key)
      ) {
        return { ok: false, status: 422, code: 'CURRICULUM_FEEDBACK_HASH_INVALID' }
      }
      if (
        (payload.confirmation !== 'confirmed' && payload.confirmation !== 'complemented') ||
        (payload.confirmation === 'confirmed' && payload.complement !== '') ||
        (payload.confirmation === 'complemented' && payload.complement.trim().length < 1)
      ) {
        return { ok: false, status: 422, code: 'CURRICULUM_FEEDBACK_CONFIRMATION_INVALID' }
      }
      if (payload.calibration_state !== 'pending_review') {
        return { ok: false, status: 422, code: 'CURRICULUM_FEEDBACK_STATE_INVALID' }
      }
      if (
        typeof payload.proof_expires_at !== 'number' ||
        !isFinite(payload.proof_expires_at) ||
        Math.floor(payload.proof_expires_at) !== payload.proof_expires_at ||
        payload.proof_expires_at < 1
      ) {
        return { ok: false, status: 422, code: 'CURRICULUM_FEEDBACK_PROOF_EXPIRED' }
      }

      var expectedIdempotencyKey = $security.sha256(
        canonicalCurriculumFeedbackJson(curriculumFeedbackImmutablePayload(payload)),
      )
      if (!curriculumFeedbackConstantTimeEqual(expectedIdempotencyKey, payload.idempotency_key)) {
        return { ok: false, status: 409, code: 'CURRICULUM_FEEDBACK_IDEMPOTENCY_MISMATCH' }
      }
      return { ok: true }
    }

    var validateCurriculumFeedbackProofFreshness = function (payload, nowSeconds) {
      if (payload.proof_expires_at <= nowSeconds || payload.proof_expires_at > nowSeconds + 900) {
        return { ok: false, status: 422, code: 'CURRICULUM_FEEDBACK_PROOF_EXPIRED' }
      }
      return { ok: true }
    }

    var curriculumFeedbackRecordPayload = function (record) {
      return {
        schema_version: record.getString('schema_version'),
        operation: record.getString('operation'),
        vacancy_id: record.getString('vacancy_id'),
        wordpress_job_id: record.getString('wordpress_job_id'),
        application_id: record.getString('application_id'),
        analysis_id: record.getString('analysis_id'),
        analysis_version: record.getString('analysis_version'),
        analysis_agent: record.getString('analysis_agent'),
        interpretation_request_id: record.getString('interpretation_request_id'),
        interpretation_model: record.getString('interpretation_model'),
        criteria_version: record.getString('criteria_version'),
        source_fingerprint: record.getString('source_fingerprint'),
        perception: record.getString('perception'),
        understanding: record.getString('understanding'),
        justification: record.getString('justification'),
        confirmation: record.getString('confirmation'),
        complement: record.getString('complement'),
        actor_id: record.getString('actor_id'),
        proof_expires_at: record.getInt('proof_expires_at'),
        proof_signature: record.getString('proof_signature'),
        calibration_state: record.getString('calibration_state'),
        idempotency_key: record.getString('idempotency_key'),
      }
    }

    var findCurriculumFeedbackByIdempotencyKey = function (idempotencyKey) {
      try {
        return $app.findFirstRecordByFilter(
          'curriculum_feedback',
          'idempotency_key = "' + idempotencyKey + '"',
        )
      } catch (_) {
        return null
      }
    }

    var exactCurriculumFeedbackReadback = function (record, expectedPayload) {
      if (!record || !/^[A-Za-z0-9_-]{1,160}$/.test(curriculumFeedbackSafeString(record.id))) {
        return null
      }
      var persistedPayload = curriculumFeedbackRecordPayload(record)
      if (
        canonicalCurriculumFeedbackJson(persistedPayload) !==
        canonicalCurriculumFeedbackJson(expectedPayload)
      ) {
        return null
      }
      return persistedPayload
    }

    var curriculumFeedbackSuccess = function (e, record, payload, duplicate) {
      var readback = exactCurriculumFeedbackReadback(record, payload)
      if (!readback) {
        return e.json(500, { ok: false, code: 'CURRICULUM_FEEDBACK_READBACK_MISMATCH' })
      }
      return e.json(200, {
        ok: true,
        duplicate: duplicate,
        verified: true,
        feedback_id: curriculumFeedbackSafeString(record.id),
        record: readback,
      })
    }

    var actor = resolveCurriculumFeedbackActor(e)
    if (!actor.ok) return e.json(403, { ok: false, code: actor.code })

    var requestBody = null
    try {
      requestBody = e.requestInfo().body || null
      if (typeof requestBody === 'string') requestBody = JSON.parse(requestBody)
    } catch (_) {
      return e.json(400, { ok: false, code: 'CURRICULUM_FEEDBACK_REQUEST_INVALID' })
    }
    if (!requestBody || typeof requestBody !== 'object' || Array.isArray(requestBody)) {
      return e.json(400, { ok: false, code: 'CURRICULUM_FEEDBACK_REQUEST_INVALID' })
    }

    var secret = curriculumFeedbackSafeString(
      $secrets.get('PMAIS_IRIS_GV_HMAC_SECRET') || '',
    ).trim()
    var timestamp = curriculumFeedbackSafeString(
      e.request.header.get('X-PMais-Timestamp') || '',
    ).trim()
    var suppliedSignature = curriculumFeedbackSafeString(
      e.request.header.get('X-PMais-Signature') || '',
    )
      .trim()
      .toLowerCase()
    var nowSeconds = Math.floor(Date.now() / 1000)
    if (
      !secret ||
      !/^\d{10}$/.test(timestamp) ||
      Math.abs(nowSeconds - Number(timestamp)) > 300 ||
      !/^[a-f0-9]{64}$/.test(suppliedSignature)
    ) {
      return e.json(401, { ok: false, code: 'CURRICULUM_FEEDBACK_SIGNATURE_INVALID' })
    }
    var expectedSignature = $security.hs256(
      timestamp + '.' + canonicalCurriculumFeedbackJson(requestBody),
      secret,
    )
    if (!curriculumFeedbackConstantTimeEqual(expectedSignature, suppliedSignature)) {
      return e.json(401, { ok: false, code: 'CURRICULUM_FEEDBACK_SIGNATURE_INVALID' })
    }

    var validation = validateCurriculumFeedbackPayload(requestBody, actor.id, nowSeconds)
    if (!validation.ok) {
      return e.json(validation.status, { ok: false, code: validation.code })
    }

    var existing = findCurriculumFeedbackByIdempotencyKey(requestBody.idempotency_key)
    if (existing) {
      var existingReadback = exactCurriculumFeedbackReadback(existing, requestBody)
      if (!existingReadback) {
        return e.json(409, { ok: false, code: 'CURRICULUM_FEEDBACK_REPLAY_MISMATCH' })
      }
      return e.json(200, {
        ok: true,
        duplicate: true,
        verified: true,
        feedback_id: curriculumFeedbackSafeString(existing.id),
        record: existingReadback,
      })
    }

    var freshness = validateCurriculumFeedbackProofFreshness(requestBody, nowSeconds)
    if (!freshness.ok) {
      return e.json(freshness.status, { ok: false, code: freshness.code })
    }

    var collection = null
    try {
      collection = $app.findCollectionByNameOrId('curriculum_feedback')
    } catch (_) {
      return e.json(503, { ok: false, code: 'CURRICULUM_FEEDBACK_STORAGE_UNAVAILABLE' })
    }
    var feedback = new Record(collection)
    for (var fieldIndex = 0; fieldIndex < curriculumFeedbackPayloadKeys.length; fieldIndex++) {
      var field = curriculumFeedbackPayloadKeys[fieldIndex]
      feedback.set(field, requestBody[field])
    }

    try {
      $app.save(feedback)
    } catch (_) {
      var racedRecord = findCurriculumFeedbackByIdempotencyKey(requestBody.idempotency_key)
      if (racedRecord) {
        var racedReadback = exactCurriculumFeedbackReadback(racedRecord, requestBody)
        if (racedReadback) {
          return e.json(200, {
            ok: true,
            duplicate: true,
            verified: true,
            feedback_id: curriculumFeedbackSafeString(racedRecord.id),
            record: racedReadback,
          })
        }
      }
      return e.json(500, { ok: false, code: 'CURRICULUM_FEEDBACK_PERSISTENCE_FAILED' })
    }

    var persisted = null
    try {
      persisted = $app.findRecordById('curriculum_feedback', feedback.id)
    } catch (_) {
      return e.json(500, { ok: false, code: 'CURRICULUM_FEEDBACK_READBACK_FAILED' })
    }
    return curriculumFeedbackSuccess(e, persisted, requestBody, false)
  },
  $apis.requireAuth(),
)
