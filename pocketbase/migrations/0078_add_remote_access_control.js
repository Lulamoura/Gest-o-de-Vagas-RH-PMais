migrate(
  (app) => {
    var users = app.findCollectionByNameOrId('users')
    var parameters = app.findCollectionByNameOrId('system_parameters')
    var migrationCollisions = []
    if (users.fields.getByName('permitir_acesso_fora_pmais')) {
      migrationCollisions.push('users.permitir_acesso_fora_pmais')
    }
    if (parameters.fields.getByName('restringir_acesso_fora_pmais')) {
      migrationCollisions.push('system_parameters.restringir_acesso_fora_pmais')
    }
    if (parameters.fields.getByName('redes_autorizadas_pmais')) {
      migrationCollisions.push('system_parameters.redes_autorizadas_pmais')
    }
    for (var collisionName of [
      'remote_access_challenges',
      'remote_access_sessions',
      'remote_access_rate_limits',
      'remote_access_audit',
    ]) {
      try {
        app.findCollectionByNameOrId(collisionName)
        migrationCollisions.push(collisionName)
      } catch (_) {}
    }
    if (migrationCollisions.length > 0) {
      throw new Error('Remote access migration collision: ' + migrationCollisions.join(', '))
    }

    if (!users.fields.getByName('permitir_acesso_fora_pmais')) {
      users.fields.add(
        new BoolField({
          name: 'permitir_acesso_fora_pmais',
          required: false,
        }),
      )
      app.save(users)
    }

    var parametersChanged = false
    if (!parameters.fields.getByName('restringir_acesso_fora_pmais')) {
      parameters.fields.add(
        new BoolField({
          name: 'restringir_acesso_fora_pmais',
          required: false,
        }),
      )
      parametersChanged = true
    }
    if (!parameters.fields.getByName('redes_autorizadas_pmais')) {
      parameters.fields.add(
        new TextField({
          name: 'redes_autorizadas_pmais',
          required: false,
          max: 4000,
        }),
      )
      parametersChanged = true
    }
    if (parametersChanged) app.save(parameters)

    var parameterRecords = app.findRecordsByFilter('system_parameters', '', '', 0, 0)
    for (var i = 0; i < parameterRecords.length; i++) {
      var parameter = parameterRecords[i]
      parameter.set('restringir_acesso_fora_pmais', false)
      if (!parameter.getString('redes_autorizadas_pmais')) {
        parameter.set('redes_autorizadas_pmais', '143.208.130.134/32')
      }
      app.save(parameter)
    }
    if (parameterRecords.length === 0) {
      var baselineParameter = new Record(parameters)
      if (parameters.fields.getByName('prazo_alerta_dias')) {
        baselineParameter.set('prazo_alerta_dias', 30)
      }
      baselineParameter.set('restringir_acesso_fora_pmais', false)
      baselineParameter.set('redes_autorizadas_pmais', '143.208.130.134/32')
      app.save(baselineParameter)
    }

    var challenges = null
    try {
      challenges = app.findCollectionByNameOrId('remote_access_challenges')
    } catch (_) {}
    if (!challenges) {
      challenges = new Collection({
        name: 'remote_access_challenges',
        type: 'base',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'user',
            type: 'relation',
            collectionId: users.id,
            maxSelect: 1,
            cascadeDelete: true,
            required: true,
          },
          { name: 'generation', type: 'number', required: false, min: 0, onlyInt: true },
          { name: 'code_hmac', type: 'text', required: true, max: 64 },
          { name: 'expires_at', type: 'number', required: true, min: 1, onlyInt: true },
          { name: 'resend_after', type: 'number', required: true, min: 1, onlyInt: true },
          {
            name: 'attempts_remaining',
            type: 'number',
            required: false,
            min: 0,
            max: 5,
            onlyInt: true,
          },
          { name: 'consumed', type: 'bool', required: false },
          { name: 'revoked', type: 'bool', required: false },
          { name: 'source_ip_digest', type: 'text', required: false, max: 64 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_remote_access_challenges_user ON remote_access_challenges (user)',
          'CREATE INDEX idx_remote_access_challenges_expiry ON remote_access_challenges (expires_at)',
          'CREATE UNIQUE INDEX idx_remote_access_challenges_active_user ON remote_access_challenges (user) WHERE consumed = FALSE AND revoked = FALSE',
        ],
      })
      app.save(challenges)
    }

    var sessions = null
    try {
      sessions = app.findCollectionByNameOrId('remote_access_sessions')
    } catch (_) {}
    if (!sessions) {
      sessions = new Collection({
        name: 'remote_access_sessions',
        type: 'base',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'user',
            type: 'relation',
            collectionId: users.id,
            maxSelect: 1,
            cascadeDelete: true,
            required: true,
          },
          {
            name: 'challenge',
            type: 'relation',
            collectionId: challenges.id,
            maxSelect: 1,
            cascadeDelete: false,
            required: false,
          },
          { name: 'token_digest', type: 'text', required: true, max: 64 },
          { name: 'issued_at', type: 'number', required: true, min: 1, onlyInt: true },
          { name: 'expires_at', type: 'number', required: true, min: 1, onlyInt: true },
          { name: 'generation', type: 'number', required: false, min: 0, onlyInt: true },
          { name: 'revoked', type: 'bool', required: false },
          { name: 'source_ip_digest', type: 'text', required: false, max: 64 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_remote_access_sessions_token_digest ON remote_access_sessions (token_digest)',
          'CREATE INDEX idx_remote_access_sessions_user ON remote_access_sessions (user)',
          'CREATE INDEX idx_remote_access_sessions_expiry ON remote_access_sessions (expires_at)',
        ],
      })
      app.save(sessions)
    }

    var rateLimits = null
    try {
      rateLimits = app.findCollectionByNameOrId('remote_access_rate_limits')
    } catch (_) {}
    if (!rateLimits) {
      rateLimits = new Collection({
        name: 'remote_access_rate_limits',
        type: 'base',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'key_digest', type: 'text', required: true, max: 64 },
          { name: 'window_start', type: 'number', required: false, min: 0, onlyInt: true },
          { name: 'request_count', type: 'number', required: false, min: 0, onlyInt: true },
          { name: 'blocked_until', type: 'number', required: false, min: 0, onlyInt: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_remote_access_rate_limits_key ON remote_access_rate_limits (key_digest)',
          'CREATE INDEX idx_remote_access_rate_limits_updated ON remote_access_rate_limits (updated DESC)',
        ],
      })
      app.save(rateLimits)
    }

    var audit = null
    try {
      audit = app.findCollectionByNameOrId('remote_access_audit')
    } catch (_) {}
    if (!audit) {
      audit = new Collection({
        name: 'remote_access_audit',
        type: 'base',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'event', type: 'text', required: true, max: 80 },
          {
            name: 'actor',
            type: 'relation',
            collectionId: users.id,
            maxSelect: 1,
            cascadeDelete: false,
            required: false,
          },
          {
            name: 'target_user',
            type: 'relation',
            collectionId: users.id,
            maxSelect: 1,
            cascadeDelete: false,
            required: false,
          },
          { name: 'result', type: 'text', required: true, max: 40 },
          { name: 'source_ip_digest', type: 'text', required: false, max: 64 },
          { name: 'details', type: 'text', required: false, max: 4000 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        ],
        indexes: [
          'CREATE INDEX idx_remote_access_audit_event ON remote_access_audit (event)',
          'CREATE INDEX idx_remote_access_audit_actor ON remote_access_audit (actor)',
          'CREATE INDEX idx_remote_access_audit_target_user ON remote_access_audit (target_user)',
          'CREATE INDEX idx_remote_access_audit_created ON remote_access_audit (created DESC)',
        ],
      })
      app.save(audit)
    }
  },
  (app) => {
    for (var name of [
      'remote_access_audit',
      'remote_access_rate_limits',
      'remote_access_sessions',
      'remote_access_challenges',
    ]) {
      app.delete(app.findCollectionByNameOrId(name))
    }

    var parameters = app.findCollectionByNameOrId('system_parameters')
    parameters.fields.removeByName('redes_autorizadas_pmais')
    parameters.fields.removeByName('restringir_acesso_fora_pmais')
    app.save(parameters)

    var users = app.findCollectionByNameOrId('users')
    users.fields.removeByName('permitir_acesso_fora_pmais')
    app.save(users)
  },
)
