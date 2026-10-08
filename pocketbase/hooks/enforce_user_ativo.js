/**
 * Bloqueia a autenticação e renovação de sessão de usuários inativos (ativo = false).
 * Lança ForbiddenError com mensagem clara solicitando contato com o administrador.
 */
onRecordAuthRequest((e) => {
  if (e.record) {
    var ativo = e.record.get('ativo')
    if (ativo === false || ativo === 0 || ativo === '0') {
      throw new ForbiddenError('Usuário inativo. Contate o administrador.')
    }
  }
  e.next()
}, 'users')

routerAdd('POST', '/backend/v1/access/login', (e) => {
  var loginAccessSecret = $secrets.get('GV_RH_ACCESS_HMAC_SECRET') || ''
  if (loginAccessSecret) {
    var loginRateLimited = false
    try {
      $app.runInTransaction((txApp) => {
        var now = Math.floor(Date.now() / 1000)
        var keyDigest = $security.hs256('login:' + e.remoteIP(), loginAccessSecret)
        var records = txApp.findRecordsByFilter(
          'remote_access_rate_limits',
          'key_digest = {:key}',
          '',
          1,
          0,
          { key: keyDigest },
        )
        var rateRecord =
          records.length === 1
            ? records[0]
            : new Record(txApp.findCollectionByNameOrId('remote_access_rate_limits'))
        var windowStart = rateRecord.getInt('window_start')
        var requestCount = rateRecord.getInt('request_count')
        if (!windowStart || windowStart <= now - 60) {
          windowStart = now
          requestCount = 0
          rateRecord.set('blocked_until', 0)
        }
        if (rateRecord.getInt('blocked_until') > now) {
          loginRateLimited = true
        } else {
          requestCount += 1
          if (requestCount > 300) {
            rateRecord.set('blocked_until', now + 60)
            loginRateLimited = true
          }
        }
        rateRecord.set('key_digest', keyDigest)
        rateRecord.set('window_start', windowStart)
        rateRecord.set('request_count', requestCount)
        txApp.save(rateRecord)
      })
    } catch (_) {
      throw new ApiError(503, 'Autenticação temporariamente indisponível.', null)
    }
    if (loginRateLimited) {
      throw e.tooManyRequestsError('Muitas tentativas. Aguarde antes de tentar novamente.', null)
    }
  }

  var body = e.requestInfo().body || {}
  var identity = typeof body.identity === 'string' ? body.identity.trim().toLowerCase() : ''
  var password = typeof body.password === 'string' ? body.password : ''

  if (!identity || identity.length > 255 || !password || password.length > 255) {
    throw e.badRequestError('E-mail ou senha inválidos.', null)
  }

  var user = null
  try {
    user = $app.findAuthRecordByEmail('users', identity)
  } catch (_) {}

  if (!user || !user.validatePassword(password)) {
    throw e.badRequestError('E-mail ou senha inválidos.', null)
  }
  if (!user.getBool('ativo')) {
    throw e.forbiddenError('Usuário inativo. Contate o administrador.', null)
  }

  var restrictionEnabled = false
  var authorizedNetworks = ''
  try {
    var parameterRecords = $app.findRecordsByFilter('system_parameters', '', 'created', 1, 0)
    if (parameterRecords.length > 0) {
      restrictionEnabled = parameterRecords[0].getBool('restringir_acesso_fora_pmais')
      authorizedNetworks = parameterRecords[0].getString('redes_autorizadas_pmais')
    }
  } catch (_) {
    throw e.forbiddenError('Acesso remoto não autorizado', null)
  }

  if (restrictionEnabled) {
    var clientIp = e.realIP()
    var immediatePeerIp = e.remoteIP()
    var trustedProxyIps = ($secrets.get('GV_RH_TRUSTED_PROXY_IPS') || '')
      .split(/[\s,;]+/)
      .map(function (value) {
        return value.trim()
      })
      .filter(function (value) {
        return value !== ''
      })
    var trustedProxy = trustedProxyIps.indexOf(immediatePeerIp) !== -1
    var isOfficeIp = false
    var networks = authorizedNetworks
      .split(/[\s,;]+/)
      .map(function (value) {
        return value.trim()
      })
      .filter(function (value) {
        return value !== ''
      })

    for (var i = 0; i < networks.length; i++) {
      var parts = networks[i].split('/')
      if (trustedProxy && parts.length === 2 && parts[1] === '32' && parts[0] === clientIp) {
        isOfficeIp = true
        break
      }
    }

    if (!isOfficeIp && !user.getBool('permitir_acesso_fora_pmais')) {
      return e.json(403, {
        status: 403,
        code: 'remote_access_unauthorized',
        message: 'Acesso remoto não autorizado',
        data: {},
      })
    }

    if (!isOfficeIp) {
      var accessSecret = $secrets.get('GV_RH_ACCESS_HMAC_SECRET') || ''
      var resendKey = $secrets.get('RESEND_API_KEY') || ''
      if (!accessSecret || !resendKey) {
        throw new ApiError(503, 'Não foi possível enviar o código de acesso.', null)
      }

      var now = Math.floor(Date.now() / 1000)
      var code = ''
      var challenge = null
      var generation = 1
      var expiresAt = now + 300
      var reusedChallenge = false
      $app.runInTransaction((txApp) => {
        var activeChallenges = txApp.findRecordsByFilter(
          'remote_access_challenges',
          'user = {:user} && consumed = false && revoked = false',
          '-created',
          0,
          0,
          { user: user.id },
        )
        for (var challengeIndex = 0; challengeIndex < activeChallenges.length; challengeIndex++) {
          var existingChallenge = activeChallenges[challengeIndex]
          if (
            !reusedChallenge &&
            existingChallenge.getInt('expires_at') > now &&
            existingChallenge.getInt('resend_after') > now &&
            existingChallenge.getInt('attempts_remaining') > 0
          ) {
            challenge = existingChallenge
            generation = existingChallenge.getInt('generation')
            expiresAt = existingChallenge.getInt('expires_at')
            reusedChallenge = true
          } else {
            existingChallenge.set('revoked', true)
            txApp.save(existingChallenge)
          }
        }

        if (reusedChallenge) return

        code = $security.randomStringWithAlphabet(6, '0123456789')
        challenge = new Record(txApp.findCollectionByNameOrId('remote_access_challenges'))
        challenge.id = $security.randomStringWithAlphabet(
          15,
          'abcdefghijklmnopqrstuvwxyz0123456789',
        )
        challenge.set('user', user.id)
        challenge.set('generation', generation)
        challenge.set(
          'code_hmac',
          $security.hs256(
            challenge.id + ':' + user.id + ':' + generation + ':' + code + ':' + expiresAt,
            accessSecret,
          ),
        )
        challenge.set('expires_at', expiresAt)
        challenge.set('resend_after', now + 60)
        challenge.set('attempts_remaining', 5)
        challenge.set('consumed', false)
        challenge.set('revoked', false)
        challenge.set('source_ip_digest', $security.hs256(clientIp, accessSecret))
        txApp.save(challenge)
      })

      if (reusedChallenge) {
        var existingEmailParts = user.getString('email').split('@')
        var existingMaskedEmail =
          (existingEmailParts[0] ? existingEmailParts[0].slice(0, 1) : '*') +
          '***@' +
          (existingEmailParts[1] || '')
        return e.json(202, {
          type: 'remote_mfa_required',
          challengeId: challenge.id,
          maskedEmail: existingMaskedEmail,
          expiresIn: Math.max(1, expiresAt - now),
          resendAfter: Math.max(0, challenge.getInt('resend_after') - now),
        })
      }

      var senderName = 'PMais RH'
      var senderEmail = 'vagas@pmaisservicos.com.br'
      try {
        if (parameterRecords.length > 0) {
          if (parameterRecords[0].getString('nome_remetente')) {
            senderName = parameterRecords[0].getString('nome_remetente')
          }
          if (parameterRecords[0].getString('email_remetente')) {
            senderEmail = parameterRecords[0].getString('email_remetente')
          }
        }
      } catch (_) {}

      var mailResponse = null
      try {
        mailResponse = $http.send({
          url: 'https://api.resend.com/emails',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + resendKey,
          },
          body: JSON.stringify({
            from: senderName + ' <' + senderEmail + '>',
            to: [user.getString('email')],
            subject: 'Código de acesso remoto — PMais RH',
            html:
              '<p>Seu código de acesso remoto é:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">' +
              code +
              '</p><p>O código é válido por 5 minutos e pode ser usado uma única vez.</p>',
          }),
          timeout: 15,
        })
      } catch (_) {}

      if (!mailResponse || mailResponse.statusCode < 200 || mailResponse.statusCode >= 300) {
        try {
          $app.delete(challenge)
        } catch (_) {}
        throw new ApiError(503, 'Não foi possível enviar o código de acesso.', null)
      }

      var issuedAudit = new Record($app.findCollectionByNameOrId('remote_access_audit'))
      issuedAudit.set('event', 'remote_otp_issued')
      issuedAudit.set('target_user', user.id)
      issuedAudit.set('result', 'success')
      issuedAudit.set('source_ip_digest', $security.hs256(clientIp, accessSecret))
      issuedAudit.set('details', JSON.stringify({ generation: generation }))
      $app.save(issuedAudit)

      var emailParts = user.getString('email').split('@')
      var maskedEmail =
        (emailParts[0] ? emailParts[0].slice(0, 1) : '*') + '***@' + (emailParts[1] || '')
      return e.json(202, {
        type: 'remote_mfa_required',
        challengeId: challenge.id,
        maskedEmail: maskedEmail,
        expiresIn: 300,
        resendAfter: 60,
      })
    }
  }

  return $apis.recordAuthResponse(e, user, 'password', null)
})

onRecordAuthRequest((e) => {
  var meta = e.meta
  if (!meta || meta.accessFlow !== 'remote_otp') {
    var denyAuth = function () {
      return e.json(403, {
        status: 403,
        code: 'remote_access_unauthorized',
        message: 'Acesso remoto não autorizado',
        data: {},
      })
    }
    var authParameters = null
    try {
      authParameters = $app.findRecordsByFilter('system_parameters', '', 'created', 1, 0)
    } catch (_) {
      return denyAuth()
    }
    if (authParameters.length < 1) return denyAuth()
    var authParameter = authParameters[0]
    if (!authParameter.getBool('restringir_acesso_fora_pmais')) {
      e.next()
      return
    }

    var authClientIp = e.realIP()
    var authImmediatePeerIp = e.remoteIP()
    var authTrustedProxyIps = ($secrets.get('GV_RH_TRUSTED_PROXY_IPS') || '')
      .split(/[\s,;]+/)
      .map(function (value) {
        return value.trim()
      })
      .filter(function (value) {
        return value !== ''
      })
    var authTrustedProxy = authTrustedProxyIps.indexOf(authImmediatePeerIp) !== -1
    var authNetworks = authParameter
      .getString('redes_autorizadas_pmais')
      .split(/[\s,;]+/)
      .map(function (value) {
        return value.trim()
      })
      .filter(function (value) {
        return value !== ''
      })
    for (var authIndex = 0; authIndex < authNetworks.length; authIndex++) {
      var authParts = authNetworks[authIndex].split('/')
      if (
        authTrustedProxy &&
        authParts.length === 2 &&
        authParts[1] === '32' &&
        authParts[0] === authClientIp
      ) {
        e.next()
        return
      }
    }

    if (e.authMethod === '') {
      e.next()
      return
    }

    return denyAuth()
  }

  e.meta = null
  var challengeId = typeof meta.challengeId === 'string' ? meta.challengeId : ''
  var code = typeof meta.code === 'string' ? meta.code : ''
  var clientIp = typeof meta.clientIp === 'string' ? meta.clientIp : ''
  var accessSecret = $secrets.get('GV_RH_ACCESS_HMAC_SECRET') || ''
  if (!accessSecret || !challengeId || !/^\d{6}$/.test(code) || !clientIp || !e.token) {
    throw e.badRequestError('Código inválido ou expirado.', null)
  }

  var failure = ''
  $app.runInTransaction((txApp) => {
    var now = Math.floor(Date.now() / 1000)
    var challenge = null
    try {
      challenge = txApp.findRecordById('remote_access_challenges', challengeId)
    } catch (_) {
      failure = 'invalid'
      return
    }

    var user = txApp.findRecordById('users', challenge.getString('user'))
    var generation = challenge.getInt('generation')
    var expiresAt = challenge.getInt('expires_at')
    var attemptsRemaining = challenge.getInt('attempts_remaining')
    var expectedHmac = $security.hs256(
      challenge.id + ':' + user.id + ':' + generation + ':' + code + ':' + expiresAt,
      accessSecret,
    )

    if (
      challenge.getBool('consumed') ||
      challenge.getBool('revoked') ||
      expiresAt <= now ||
      attemptsRemaining <= 0 ||
      !$security.equal(expectedHmac, challenge.getString('code_hmac'))
    ) {
      var remainingAfterFailure = attemptsRemaining
      if (
        !challenge.getBool('consumed') &&
        !challenge.getBool('revoked') &&
        attemptsRemaining > 0
      ) {
        remainingAfterFailure = attemptsRemaining - 1
        challenge.set('attempts_remaining', remainingAfterFailure)
        txApp.save(challenge)
      }
      var failedAudit = new Record(txApp.findCollectionByNameOrId('remote_access_audit'))
      failedAudit.set('event', expiresAt <= now ? 'remote_otp_expired' : 'remote_otp_failed')
      failedAudit.set('target_user', user.id)
      failedAudit.set('result', 'failure')
      failedAudit.set('source_ip_digest', $security.hs256(clientIp, accessSecret))
      failedAudit.set(
        'details',
        JSON.stringify({ generation: generation, attemptsRemaining: remainingAfterFailure }),
      )
      txApp.save(failedAudit)
      failure = 'invalid'
      return
    }

    if (!user.getBool('ativo') || !user.getBool('permitir_acesso_fora_pmais')) {
      failure = 'unauthorized'
      return
    }

    challenge.set('consumed', true)
    txApp.save(challenge)

    var session = new Record(txApp.findCollectionByNameOrId('remote_access_sessions'))
    session.set('user', user.id)
    session.set('challenge', challenge.id)
    session.set('token_digest', $security.hs256(e.token, accessSecret))
    session.set('issued_at', now)
    session.set('expires_at', now + 43200)
    session.set('generation', 1)
    session.set('revoked', false)
    session.set('source_ip_digest', $security.hs256(clientIp, accessSecret))
    txApp.save(session)

    var verifiedAudit = new Record(txApp.findCollectionByNameOrId('remote_access_audit'))
    verifiedAudit.set('event', 'remote_otp_verified')
    verifiedAudit.set('target_user', user.id)
    verifiedAudit.set('result', 'success')
    verifiedAudit.set('source_ip_digest', $security.hs256(clientIp, accessSecret))
    verifiedAudit.set('details', JSON.stringify({ generation: generation }))
    txApp.save(verifiedAudit)
  })

  if (failure === 'unauthorized') {
    return e.json(403, {
      status: 403,
      code: 'remote_access_unauthorized',
      message: 'Acesso remoto não autorizado',
      data: {},
    })
  }
  if (failure) {
    throw e.badRequestError('Código inválido ou expirado.', null)
  }

  e.next()
}, 'users')

routerAdd('POST', '/backend/v1/access/verify', (e) => {
  var body = e.requestInfo().body || {}
  var challengeId = typeof body.challengeId === 'string' ? body.challengeId.trim() : ''
  var code = typeof body.code === 'string' ? body.code.trim() : ''
  if (!/^[a-z0-9]{15}$/.test(challengeId) || !/^\d{6}$/.test(code)) {
    throw e.badRequestError('Código inválido ou expirado.', null)
  }

  var challenge = null
  var user = null
  try {
    challenge = $app.findRecordById('remote_access_challenges', challengeId)
    user = $app.findRecordById('users', challenge.getString('user'))
  } catch (_) {
    throw e.badRequestError('Código inválido ou expirado.', null)
  }

  return $apis.recordAuthResponse(e, user, '', {
    accessFlow: 'remote_otp',
    challengeId: challengeId,
    code: code,
    clientIp: e.realIP(),
  })
})

routerAdd('POST', '/backend/v1/access/resend', (e) => {
  var body = e.requestInfo().body || {}
  var challengeId = typeof body.challengeId === 'string' ? body.challengeId.trim() : ''
  if (!/^[a-z0-9]{15}$/.test(challengeId)) {
    throw e.badRequestError('Código inválido ou expirado.', null)
  }

  var challenge = null
  try {
    challenge = $app.findRecordById('remote_access_challenges', challengeId)
  } catch (_) {
    throw e.badRequestError('Código inválido ou expirado.', null)
  }
  var now = Math.floor(Date.now() / 1000)
  if (
    challenge.getBool('consumed') ||
    challenge.getBool('revoked') ||
    challenge.getInt('expires_at') <= now
  ) {
    throw e.badRequestError('Código inválido ou expirado.', null)
  }
  if (challenge.getInt('resend_after') > now) {
    throw e.tooManyRequestsError('Aguarde antes de solicitar um novo código.', null)
  }

  var attemptsRemaining = challenge.getInt('attempts_remaining')
  if (attemptsRemaining <= 0) {
    throw e.badRequestError('Código inválido ou expirado.', null)
  }

  var user = null
  try {
    user = $app.findRecordById('users', challenge.getString('user'))
  } catch (_) {
    throw e.badRequestError('Código inválido ou expirado.', null)
  }
  if (!user.getBool('ativo') || !user.getBool('permitir_acesso_fora_pmais')) {
    return e.json(403, {
      status: 403,
      code: 'remote_access_unauthorized',
      message: 'Acesso remoto não autorizado',
      data: {},
    })
  }

  var accessSecret = $secrets.get('GV_RH_ACCESS_HMAC_SECRET') || ''
  var resendKey = $secrets.get('RESEND_API_KEY') || ''
  if (!accessSecret || !resendKey) {
    throw new ApiError(503, 'Não foi possível enviar o código de acesso.', null)
  }

  var generation = challenge.getInt('generation') + 1
  var code = $security.randomStringWithAlphabet(6, '0123456789')
  var expiresAt = now + 300
  challenge.set('generation', generation)
  challenge.set(
    'code_hmac',
    $security.hs256(
      challenge.id +
        ':' +
        user.id +
        ':' +
        String(generation) +
        ':' +
        code +
        ':' +
        String(expiresAt),
      accessSecret,
    ),
  )
  challenge.set('expires_at', expiresAt)
  challenge.set('resend_after', now + 60)
  challenge.set('source_ip_digest', $security.hs256(e.realIP(), accessSecret))
  $app.save(challenge)

  var response = null
  try {
    response = $http.send({
      url: 'https://api.resend.com/emails',
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + resendKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PMais RH <vagas@pmaisservicos.com.br>',
        to: [user.getString('email')],
        subject: 'Código de acesso ao PMais RH',
        html:
          '<p>Seu código de acesso é:</p><p style="font-size:28px;font-weight:bold;letter-spacing:8px">' +
          code +
          '</p><p>O código expira em 5 minutos e pode ser usado uma única vez.</p>',
      }),
      timeout: 15,
    })
  } catch (_) {}

  if (!response || response.statusCode < 200 || response.statusCode >= 300) {
    challenge.set('revoked', true)
    $app.save(challenge)
    throw new ApiError(503, 'Não foi possível enviar o código de acesso.', null)
  }

  var resentAudit = new Record($app.findCollectionByNameOrId('remote_access_audit'))
  resentAudit.set('event', 'remote_otp_resent')
  resentAudit.set('target_user', user.id)
  resentAudit.set('result', 'success')
  resentAudit.set('source_ip_digest', $security.hs256(e.realIP(), accessSecret))
  resentAudit.set('details', JSON.stringify({ generation: generation }))
  $app.save(resentAudit)

  var email = user.getString('email')
  var at = email.indexOf('@')
  var local = at > 0 ? email.substring(0, at) : email
  var domain = at > 0 ? email.substring(at) : ''
  var masked = local.substring(0, Math.min(2, local.length)) + '***' + domain
  return e.json(202, {
    type: 'remote_mfa_required',
    challengeId: challenge.id,
    maskedEmail: masked,
    expiresIn: 300,
    resendAfter: 60,
  })
})

routerAdd(
  'PUT',
  '/backend/v1/access/settings',
  (e) => {
    var actor = null
    try {
      actor = $app.findRecordById('users', e.auth.id)
    } catch (_) {
      throw e.forbiddenError('Acesso não autorizado.', null)
    }
    if (!actor.getBool('ativo') || actor.getString('profile') !== 'superadmin') {
      throw e.forbiddenError('Acesso não autorizado.', null)
    }

    var body = e.requestInfo().body || {}
    if (typeof body.restrictionEnabled !== 'boolean' || !Array.isArray(body.officeNetworks)) {
      throw e.badRequestError('Configuração de acesso remoto inválida.', null)
    }
    if (body.officeNetworks.length < 1 || body.officeNetworks.length > 20) {
      throw e.badRequestError('Configuração de acesso remoto inválida.', null)
    }

    var normalizedNetworks = []
    for (var networkIndex = 0; networkIndex < body.officeNetworks.length; networkIndex++) {
      var network =
        typeof body.officeNetworks[networkIndex] === 'string'
          ? body.officeNetworks[networkIndex].trim()
          : ''
      var cidrParts = network.split('/')
      var octets = cidrParts.length === 2 ? cidrParts[0].split('.') : []
      var validNetwork = cidrParts.length === 2 && cidrParts[1] === '32' && octets.length === 4
      for (var octetIndex = 0; validNetwork && octetIndex < octets.length; octetIndex++) {
        if (!/^\d{1,3}$/.test(octets[octetIndex])) validNetwork = false
        var octet = Number(octets[octetIndex])
        if (octet < 0 || octet > 255 || String(octet) !== octets[octetIndex]) {
          validNetwork = false
        }
      }
      if (!validNetwork || cidrParts[0] === '0.0.0.0') {
        throw e.badRequestError('Configuração de acesso remoto inválida.', null)
      }
      if (normalizedNetworks.indexOf(network) === -1) normalizedNetworks.push(network)
    }
    if (normalizedNetworks.length !== body.officeNetworks.length) {
      throw e.badRequestError('Configuração de acesso remoto inválida.', null)
    }

    var response = null
    $app.runInTransaction((txApp) => {
      var parameters = txApp.findRecordsByFilter('system_parameters', '', 'created', 1, 0)
      if (parameters.length !== 1) throw new Error('Configuração do sistema indisponível.')
      var parameter = parameters[0]
      var oldRestriction = parameter.getBool('restringir_acesso_fora_pmais')
      var oldNetworks = parameter.getString('redes_autorizadas_pmais')
      var newNetworks = normalizedNetworks.join('\n')
      var restrictionChanged = oldRestriction !== body.restrictionEnabled
      var networksChanged = oldNetworks !== newNetworks

      parameter.set('restringir_acesso_fora_pmais', body.restrictionEnabled)
      parameter.set('redes_autorizadas_pmais', newNetworks)
      txApp.save(parameter)

      var revokedSessions = 0
      var revokedChallenges = 0
      if (restrictionChanged || networksChanged) {
        while (true) {
          var sessions = txApp.findRecordsByFilter(
            'remote_access_sessions',
            'revoked = false',
            '',
            200,
            0,
          )
          if (sessions.length === 0) break
          for (var sessionIndex = 0; sessionIndex < sessions.length; sessionIndex++) {
            sessions[sessionIndex].set('revoked', true)
            txApp.save(sessions[sessionIndex])
            revokedSessions += 1
          }
        }
        while (true) {
          var challenges = txApp.findRecordsByFilter(
            'remote_access_challenges',
            'consumed = false && revoked = false',
            '',
            200,
            0,
          )
          if (challenges.length === 0) break
          for (var challengeIndex = 0; challengeIndex < challenges.length; challengeIndex++) {
            challenges[challengeIndex].set('revoked', true)
            txApp.save(challenges[challengeIndex])
            revokedChallenges += 1
          }
        }
      }

      var accessSecret = $secrets.get('GV_RH_ACCESS_HMAC_SECRET') || ''
      var sourceDigest = accessSecret ? $security.hs256(e.realIP(), accessSecret) : ''
      var details = JSON.stringify({
        revokedSessions: revokedSessions,
        revokedChallenges: revokedChallenges,
        networkCount: normalizedNetworks.length,
      })
      if (restrictionChanged) {
        var restrictionAudit = new Record(txApp.findCollectionByNameOrId('remote_access_audit'))
        restrictionAudit.set(
          'event',
          body.restrictionEnabled
            ? 'remote_access_restriction_enabled'
            : 'remote_access_restriction_disabled',
        )
        restrictionAudit.set('actor', actor.id)
        restrictionAudit.set('result', 'success')
        if (sourceDigest) restrictionAudit.set('source_ip_digest', sourceDigest)
        restrictionAudit.set('details', details)
        txApp.save(restrictionAudit)
      }
      if (networksChanged) {
        var networkAudit = new Record(txApp.findCollectionByNameOrId('remote_access_audit'))
        networkAudit.set('event', 'remote_access_networks_changed')
        networkAudit.set('actor', actor.id)
        networkAudit.set('result', 'success')
        if (sourceDigest) networkAudit.set('source_ip_digest', sourceDigest)
        networkAudit.set('details', details)
        txApp.save(networkAudit)
      }

      response = {
        restrictionEnabled: parameter.getBool('restringir_acesso_fora_pmais'),
        officeNetworks: normalizedNetworks,
      }
    })

    return e.json(200, response)
  },
  $apis.requireAuth('users'),
)

routerAdd(
  'PUT',
  '/backend/v1/access/users/{id}/active-status',
  (e) => {
    var actor = null
    try {
      actor = $app.findRecordById('users', e.auth.id)
    } catch (_) {
      throw e.forbiddenError('Acesso não autorizado.', null)
    }
    var actorProfile = actor.getString('profile')
    if (!actor.getBool('ativo') || (actorProfile !== 'admin' && actorProfile !== 'superadmin')) {
      throw e.forbiddenError('Acesso não autorizado.', null)
    }

    var targetId = e.request.pathValue('id')
    var body = e.requestInfo().body || {}
    if (!/^[a-z0-9]{15}$/.test(targetId) || typeof body.active !== 'boolean') {
      throw e.badRequestError('Dados inválidos.', null)
    }
    if (targetId === actor.id && !body.active) {
      throw e.badRequestError('O usuário não pode desativar o próprio acesso.', null)
    }

    var updatedTarget = null
    $app.runInTransaction((txApp) => {
      var target = txApp.findRecordById('users', targetId)
      if (target.getString('profile') === 'superadmin' && actorProfile !== 'superadmin') {
        throw new ForbiddenError('Acesso não autorizado.', null)
      }
      var activeChanged = target.getBool('ativo') !== body.active
      var revokedSessions = 0
      var revokedChallenges = 0

      if (activeChanged) {
        target.set('ativo', body.active)
        txApp.save(target)

        while (true) {
          var sessions = txApp.findRecordsByFilter(
            'remote_access_sessions',
            'user = {:user} && revoked = false',
            '',
            200,
            0,
            { user: target.id },
          )
          if (sessions.length === 0) break
          for (var sessionIndex = 0; sessionIndex < sessions.length; sessionIndex++) {
            sessions[sessionIndex].set('revoked', true)
            txApp.save(sessions[sessionIndex])
            revokedSessions += 1
          }
        }
        while (true) {
          var challenges = txApp.findRecordsByFilter(
            'remote_access_challenges',
            'user = {:user} && consumed = false && revoked = false',
            '',
            200,
            0,
            { user: target.id },
          )
          if (challenges.length === 0) break
          for (var challengeIndex = 0; challengeIndex < challenges.length; challengeIndex++) {
            challenges[challengeIndex].set('revoked', true)
            txApp.save(challenges[challengeIndex])
            revokedChallenges += 1
          }
        }

        var accessSecret = $secrets.get('GV_RH_ACCESS_HMAC_SECRET') || ''
        var sourceDigest = accessSecret ? $security.hs256(e.realIP(), accessSecret) : ''
        if (!body.active) {
          var revocationAudit = new Record(txApp.findCollectionByNameOrId('remote_access_audit'))
          revocationAudit.set('event', 'remote_access_artifacts_revoked_for_deactivation')
          revocationAudit.set('actor', actor.id)
          revocationAudit.set('target_user', target.id)
          revocationAudit.set('result', 'success')
          if (sourceDigest) revocationAudit.set('source_ip_digest', sourceDigest)
          revocationAudit.set(
            'details',
            JSON.stringify({
              revokedSessions: revokedSessions,
              revokedChallenges: revokedChallenges,
            }),
          )
          txApp.save(revocationAudit)
        }

        var statusAudit = new Record(txApp.findCollectionByNameOrId('remote_access_audit'))
        statusAudit.set('event', body.active ? 'user_reactivated' : 'user_deactivated')
        statusAudit.set('actor', actor.id)
        statusAudit.set('target_user', target.id)
        statusAudit.set('result', 'success')
        if (sourceDigest) statusAudit.set('source_ip_digest', sourceDigest)
        statusAudit.set('details', '{}')
        txApp.save(statusAudit)
      }
      updatedTarget = target
    })

    return e.json(200, {
      userId: updatedTarget.id,
      active: updatedTarget.getBool('ativo'),
    })
  },
  $apis.requireAuth('users'),
)

routerAdd(
  'PUT',
  '/backend/v1/access/users/{id}/remote-permission',
  (e) => {
    var actor = null
    try {
      actor = $app.findRecordById('users', e.auth.id)
    } catch (_) {
      throw e.forbiddenError('Acesso não autorizado.', null)
    }
    if (!actor.getBool('ativo') || actor.getString('profile') !== 'superadmin') {
      throw e.forbiddenError('Acesso não autorizado.', null)
    }

    var targetId = e.request.pathValue('id')
    var body = e.requestInfo().body || {}
    if (!/^[a-z0-9]{15}$/.test(targetId) || typeof body.allowed !== 'boolean') {
      throw e.badRequestError('Dados inválidos.', null)
    }

    var updatedTarget = null
    $app.runInTransaction((txApp) => {
      var target = txApp.findRecordById('users', targetId)
      var permissionChanged = target.getBool('permitir_acesso_fora_pmais') !== body.allowed
      target.set('permitir_acesso_fora_pmais', body.allowed)
      txApp.save(target)

      var revokedSessions = 0
      var revokedChallenges = 0
      if (permissionChanged) {
        while (true) {
          var sessions = txApp.findRecordsByFilter(
            'remote_access_sessions',
            'user = {:user} && revoked = false',
            '',
            200,
            0,
            { user: target.id },
          )
          if (sessions.length === 0) break
          for (var sessionIndex = 0; sessionIndex < sessions.length; sessionIndex++) {
            sessions[sessionIndex].set('revoked', true)
            txApp.save(sessions[sessionIndex])
            revokedSessions += 1
          }
        }
        while (true) {
          var challenges = txApp.findRecordsByFilter(
            'remote_access_challenges',
            'user = {:user} && consumed = false && revoked = false',
            '',
            200,
            0,
            { user: target.id },
          )
          if (challenges.length === 0) break
          for (var challengeIndex = 0; challengeIndex < challenges.length; challengeIndex++) {
            challenges[challengeIndex].set('revoked', true)
            txApp.save(challenges[challengeIndex])
            revokedChallenges += 1
          }
        }
      }

      var audit = new Record(txApp.findCollectionByNameOrId('remote_access_audit'))
      audit.set(
        'event',
        body.allowed ? 'remote_access_permission_granted' : 'remote_access_permission_revoked',
      )
      audit.set('actor', actor.id)
      audit.set('target_user', target.id)
      audit.set('result', 'success')
      var accessSecret = $secrets.get('GV_RH_ACCESS_HMAC_SECRET') || ''
      if (accessSecret) {
        audit.set('source_ip_digest', $security.hs256(e.realIP(), accessSecret))
      }
      audit.set(
        'details',
        JSON.stringify({
          revokedSessions: revokedSessions,
          revokedChallenges: revokedChallenges,
        }),
      )
      txApp.save(audit)
      updatedTarget = target
    })

    return e.json(200, {
      userId: updatedTarget.id,
      allowed: updatedTarget.getBool('permitir_acesso_fora_pmais'),
    })
  },
  $apis.requireAuth('users'),
)

routerAdd(
  'GET',
  '/backend/v1/access/integration/session',
  (e) => {
    var user = null
    try {
      user = $app.findRecordById('users', e.auth.id)
    } catch (_) {
      throw e.unauthorizedError('Sessão inválida.', null)
    }
    if (!user.getBool('ativo')) throw e.forbiddenError('Usuário inativo.', null)
    try {
      $app.expandRecord(user, ['departamento'], null)
    } catch (_) {}
    return e.json(200, { record: user })
  },
  $apis.requireAuth('users'),
)

routerAdd(
  'GET',
  '/backend/v1/access/ip-diagnostic',
  (e) => {
    if (($secrets.get('GV_RH_IP_DIAGNOSTIC_ENABLED') || '') !== 'true') {
      throw e.notFoundError('File not found.', null)
    }
    var actor = null
    try {
      actor = $app.findRecordById('users', e.auth.id)
    } catch (_) {
      throw e.forbiddenError('Acesso não autorizado.', null)
    }
    if (!actor.getBool('ativo') || actor.getString('profile') !== 'superadmin') {
      throw e.forbiddenError('Acesso não autorizado.', null)
    }
    var restrictionEnabled = true
    try {
      var parameters = $app.findRecordsByFilter('system_parameters', '', 'created', 1, 0)
      if (parameters.length === 1) {
        restrictionEnabled = parameters[0].getBool('restringir_acesso_fora_pmais')
      }
    } catch (_) {}
    return e.json(200, {
      remoteIp: e.remoteIP(),
      realIp: e.realIP(),
      restrictionEnabled: restrictionEnabled,
    })
  },
  $apis.requireAuth('users'),
)

routerAdd(
  'GET',
  '/backend/v1/access/session',
  (e) => {
    var user = null
    try {
      user = $app.findRecordById('users', e.auth.id)
    } catch (_) {
      throw e.unauthorizedError('Sessão inválida.', null)
    }
    if (!user.getBool('ativo')) throw e.forbiddenError('Usuário inativo.', null)
    return e.json(200, { record: user })
  },
  $apis.requireAuth('users'),
)

onRecordUpdateRequest((e) => {
  var actor = null
  try {
    actor = $app.findRecordById('users', e.auth.id)
  } catch (_) {}
  if (!actor || !actor.getBool('ativo') || actor.getString('profile') !== 'superadmin') {
    throw e.forbiddenError('Acesso não autorizado.', null)
  }

  var body = e.requestInfo().body || {}
  if ('restringir_acesso_fora_pmais' in body || 'redes_autorizadas_pmais' in body) {
    throw e.forbiddenError(
      'As configurações de acesso remoto devem ser alteradas pela rota administrativa segura.',
      null,
    )
  }

  e.next()
}, 'system_parameters')

onRecordCreateRequest((e) => {
  throw e.forbiddenError(
    'Os parâmetros de segurança do sistema são provisionados pela migração e não podem ser duplicados.',
    null,
  )
}, 'system_parameters')

onRecordDeleteRequest((e) => {
  throw e.forbiddenError('Os parâmetros de segurança do sistema não podem ser excluídos.', null)
}, 'system_parameters')

routerUse(
  new Middleware(
    (e) => {
      if (!e.auth || e.auth.collection().name !== 'users') {
        return e.next()
      }

      var requestPath = e.request.url.path
      var requestMethod = e.request.method.toUpperCase()
      if (
        (requestMethod === 'GET' || requestMethod === 'POST') &&
        /^\/backend\/v1\/candidate-public-data\/[a-z0-9]+$/.test(requestPath)
      ) {
        return e.next()
      }

      var deny = function () {
        return e.json(403, {
          status: 403,
          code: 'remote_access_unauthorized',
          message: 'Acesso remoto não autorizado',
          data: {},
        })
      }

      var user = null
      try {
        user = $app.findRecordById('users', e.auth.id)
      } catch (_) {
        return deny()
      }
      if (!user.getBool('ativo')) return deny()

      var integrationReadPathAllowed =
        requestMethod === 'GET' &&
        (requestPath === '/backend/v1/access/integration/session' ||
          /^\/api\/collections\/(users|requisitions|vacancies)\/records\/[A-Za-z0-9_-]+$/.test(
            requestPath,
          ) ||
          requestPath === '/api/collections/requisition_history/records')
      if (integrationReadPathAllowed) {
        var integrationReadSecret = $secrets.get('PMAIS_IRIS_GV_HMAC_SECRET') || ''
        var integrationReadTimestamp = e.request.header.get('X-PMais-Integration-Timestamp') || ''
        var integrationReadSignature = e.request.header.get('X-PMais-Integration-Signature') || ''
        var integrationReadTimestampNumber = Number(integrationReadTimestamp)
        var integrationRequestTarget =
          requestPath + (e.request.url.rawQuery ? '?' + e.request.url.rawQuery : '')
        if (
          integrationReadSecret &&
          /^\d{10}$/.test(integrationReadTimestamp) &&
          /^[a-fA-F0-9]{64}$/.test(integrationReadSignature) &&
          Math.abs(Math.floor(Date.now() / 1000) - integrationReadTimestampNumber) <= 60
        ) {
          var integrationReadCanonical =
            integrationReadTimestamp + '\nGET\n' + integrationRequestTarget
          var integrationReadExpected = $security.hs256(
            integrationReadCanonical,
            integrationReadSecret,
          )
          if ($security.equal(integrationReadExpected, integrationReadSignature.toLowerCase())) {
            return e.next()
          }
        }
      }
      var integrationMutationPathAllowed =
        (requestMethod === 'POST' &&
          requestPath === '/api/collections/requisition_history/records') ||
        (requestMethod === 'PATCH' &&
          /^\/api\/collections\/requisitions\/records\/[A-Za-z0-9_-]+$/.test(requestPath))
      if (integrationMutationPathAllowed) {
        var integrationMutationSecret = $secrets.get('PMAIS_IRIS_GV_HMAC_SECRET') || ''
        var integrationMutationTimestamp =
          e.request.header.get('X-PMais-Integration-Timestamp') || ''
        var integrationMutationSignature =
          e.request.header.get('X-PMais-Integration-Signature') || ''
        var integrationMutationTimestampNumber = Number(integrationMutationTimestamp)
        if (
          integrationMutationSecret &&
          /^\d{10}$/.test(integrationMutationTimestamp) &&
          /^[a-fA-F0-9]{64}$/.test(integrationMutationSignature) &&
          Math.abs(Math.floor(Date.now() / 1000) - integrationMutationTimestampNumber) <= 60
        ) {
          var integrationMutationCanonicalJson = function (value) {
            if (value === null || typeof value !== 'object') return JSON.stringify(value)
            if (Array.isArray(value)) {
              return (
                '[' +
                value
                  .map(function (item) {
                    return integrationMutationCanonicalJson(item)
                  })
                  .join(',') +
                ']'
              )
            }
            var keys = Object.keys(value).sort()
            return (
              '{' +
              keys
                .map(function (key) {
                  return JSON.stringify(key) + ':' + integrationMutationCanonicalJson(value[key])
                })
                .join(',') +
              '}'
            )
          }
          var integrationMutationCanonical =
            integrationMutationTimestamp +
            '\n' +
            requestMethod +
            '\n' +
            requestPath +
            '\n' +
            integrationMutationCanonicalJson(e.requestInfo().body || {})
          var integrationMutationExpected = $security.hs256(
            integrationMutationCanonical,
            integrationMutationSecret,
          )
          if (
            $security.equal(integrationMutationExpected, integrationMutationSignature.toLowerCase())
          ) {
            return e.next()
          }
        }
      }

      if (requestMethod === 'POST' && requestPath === '/backend/v1/curriculum-feedback/commit') {
        var integrationSecret = $secrets.get('PMAIS_IRIS_GV_HMAC_SECRET') || ''
        var integrationTimestamp = e.request.header.get('X-PMais-Timestamp') || ''
        var integrationSignature = e.request.header.get('X-PMais-Signature') || ''
        var integrationTimestampNumber = Number(integrationTimestamp)
        var integrationCanonicalJson = function (value) {
          if (value === null || typeof value !== 'object') return JSON.stringify(value)
          if (Array.isArray(value)) {
            return (
              '[' +
              value
                .map(function (item) {
                  return integrationCanonicalJson(item)
                })
                .join(',') +
              ']'
            )
          }
          var keys = Object.keys(value).sort()
          return (
            '{' +
            keys
              .map(function (key) {
                return JSON.stringify(key) + ':' + integrationCanonicalJson(value[key])
              })
              .join(',') +
            '}'
          )
        }
        if (
          integrationSecret &&
          /^\d{10}$/.test(integrationTimestamp) &&
          /^[a-fA-F0-9]{64}$/.test(integrationSignature) &&
          Math.abs(Math.floor(Date.now() / 1000) - integrationTimestampNumber) <= 300
        ) {
          var integrationCanonical =
            integrationTimestamp + '.' + integrationCanonicalJson(e.requestInfo().body || {})
          var integrationExpectedSignature = $security.hs256(
            integrationCanonical,
            integrationSecret,
          )
          if ($security.equal(integrationExpectedSignature, integrationSignature.toLowerCase())) {
            return e.next()
          }
        }
      }

      var parameterRecords = null
      try {
        parameterRecords = $app.findRecordsByFilter('system_parameters', '', 'created', 1, 0)
      } catch (_) {
        return deny()
      }
      if (parameterRecords.length < 1) return deny()
      var parameter = parameterRecords[0]
      if (!parameter.getBool('restringir_acesso_fora_pmais')) return e.next()

      var clientIp = e.realIP()
      if (!clientIp) return deny()
      var immediatePeerIp = e.remoteIP()
      var trustedProxyIps = ($secrets.get('GV_RH_TRUSTED_PROXY_IPS') || '')
        .split(/[\s,;]+/)
        .map(function (value) {
          return value.trim()
        })
        .filter(function (value) {
          return value !== ''
        })
      var trustedProxy = trustedProxyIps.indexOf(immediatePeerIp) !== -1
      var networks = parameter
        .getString('redes_autorizadas_pmais')
        .split(/[\s,;]+/)
        .map(function (value) {
          return value.trim()
        })
        .filter(function (value) {
          return value !== ''
        })
      for (var i = 0; i < networks.length; i++) {
        var parts = networks[i].split('/')
        if (trustedProxy && parts.length === 2 && parts[1] === '32' && parts[0] === clientIp) {
          return e.next()
        }
      }

      if (!user.getBool('permitir_acesso_fora_pmais')) return deny()
      var accessSecret = $secrets.get('GV_RH_ACCESS_HMAC_SECRET') || ''
      if (!accessSecret) return deny()

      var authorization = e.request.header.get('Authorization') || ''
      var token = authorization.replace(/^Bearer\s+/i, '').trim()
      if (!token) return deny()
      var tokenDigest = $security.hs256(token, accessSecret)
      var sessions = null
      try {
        sessions = $app.findRecordsByFilter(
          'remote_access_sessions',
          'token_digest = {:digest} && user = {:user}',
          '-created',
          1,
          0,
          { digest: tokenDigest, user: user.id },
        )
      } catch (_) {
        return deny()
      }
      if (sessions.length !== 1) return deny()
      var session = sessions[0]
      var now = Math.floor(Date.now() / 1000)
      if (session.getBool('revoked')) return deny()
      if (session.getInt('expires_at') <= now) {
        $app.runInTransaction((txApp) => {
          var currentSession = txApp.findRecordById('remote_access_sessions', session.id)
          if (
            !currentSession.getBool('revoked') &&
            currentSession.getInt('expires_at') <= Math.floor(Date.now() / 1000)
          ) {
            currentSession.set('revoked', true)
            txApp.save(currentSession)
            var expirationAudit = new Record(txApp.findCollectionByNameOrId('remote_access_audit'))
            expirationAudit.set('event', 'remote_session_expired')
            expirationAudit.set('target_user', user.id)
            expirationAudit.set('result', 'failure')
            expirationAudit.set('source_ip_digest', $security.hs256(clientIp, accessSecret))
            expirationAudit.set('details', '{}')
            txApp.save(expirationAudit)
          }
        })
        return deny()
      }

      return e.next()
    },
    0,
    'pmaisRemoteAccessGate',
  ),
)

onRealtimeConnectRequest((e) => {
  if (e.auth && e.auth.collection().name === 'users') {
    var user = null
    try {
      user = $app.findRecordById('users', e.auth.id)
    } catch (_) {
      throw e.forbiddenError('Acesso remoto não autorizado', null)
    }
    if (!user.getBool('ativo')) throw e.forbiddenError('Acesso remoto não autorizado', null)
  }
  e.next()
})

onRealtimeSubscribeRequest((e) => {
  if (e.auth && e.auth.collection().name === 'users') {
    var user = null
    try {
      user = $app.findRecordById('users', e.auth.id)
    } catch (_) {
      throw e.forbiddenError('Acesso remoto não autorizado', null)
    }
    if (!user.getBool('ativo')) throw e.forbiddenError('Acesso remoto não autorizado', null)
  }
  e.next()
})

onRealtimeMessageSend((e) => {
  if (!e.auth || e.auth.collection().name !== 'users') {
    e.next()
    return
  }

  var user = null
  try {
    user = $app.findRecordById('users', e.auth.id)
  } catch (_) {
    return
  }
  if (!user.getBool('ativo')) return

  var parameters = null
  try {
    parameters = $app.findRecordsByFilter('system_parameters', '', 'created', 1, 0)
  } catch (_) {
    return
  }
  if (parameters.length !== 1) return
  var parameter = parameters[0]
  if (!parameter.getBool('restringir_acesso_fora_pmais')) {
    e.next()
    return
  }

  var realIp = e.realIP()
  var remoteIp = e.remoteIP()
  var trustedProxyIps = ($secrets.get('GV_RH_TRUSTED_PROXY_IPS') || '')
    .split(/[\s,;]+/)
    .map(function (value) {
      return value.trim()
    })
    .filter(function (value) {
      return value !== ''
    })
  var trustedProxy = trustedProxyIps.indexOf(remoteIp) !== -1
  var officeNetworks = parameter
    .getString('redes_autorizadas_pmais')
    .split(/[\s,;]+/)
    .map(function (value) {
      return value.trim()
    })
    .filter(function (value) {
      return value !== ''
    })
  for (var networkIndex = 0; networkIndex < officeNetworks.length; networkIndex++) {
    var parts = officeNetworks[networkIndex].split('/')
    if (trustedProxy && parts.length === 2 && parts[1] === '32' && parts[0] === realIp) {
      e.next()
      return
    }
  }

  if (!user.getBool('permitir_acesso_fora_pmais')) return
  var accessSecret = $secrets.get('GV_RH_ACCESS_HMAC_SECRET') || ''
  if (!accessSecret) return
  var authorization = e.request.header.get('Authorization') || ''
  var token = authorization.replace(/^Bearer\s+/i, '').trim()
  if (!token) return

  var sessions = null
  try {
    sessions = $app.findRecordsByFilter(
      'remote_access_sessions',
      'token_digest = {:digest} && user = {:user} && revoked = false && expires_at > {:now}',
      '',
      1,
      0,
      {
        digest: $security.hs256(token, accessSecret),
        user: user.id,
        now: Math.floor(Date.now() / 1000),
      },
    )
  } catch (_) {
    return
  }
  if (sessions.length === 1) e.next()
})
