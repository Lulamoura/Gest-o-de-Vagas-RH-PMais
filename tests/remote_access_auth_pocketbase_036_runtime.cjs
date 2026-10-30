'use strict'

const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const http = require('node:http')
const net = require('node:net')
const os = require('node:os')
const path = require('node:path')
const { spawn, spawnSync } = require('node:child_process')

const ROOT = path.join(__dirname, '..')
const POCKETBASE = process.env.POCKETBASE_BIN
assert(POCKETBASE, 'POCKETBASE_BIN must point to PocketBase 0.36.3')
assert(fs.existsSync(POCKETBASE), `PocketBase binary not found: ${POCKETBASE}`)
const version = spawnSync(POCKETBASE, ['--version'], { encoding: 'utf8' })
assert.equal(version.status, 0, version.stderr)
assert.match(version.stdout, /0\.36\.3\b/)

const workspace = fs.mkdtempSync(
  path.join(process.env.TMPDIR || os.tmpdir(), 'gv-rh-remote-auth-pb036-'),
)
const dataDirectory = path.join(workspace, 'data')
const migrationsDirectory = path.join(workspace, 'migrations')
const hooksDirectory = path.join(workspace, 'hooks')
const emptyHooksDirectory = path.join(workspace, 'empty-hooks')
for (const directory of [migrationsDirectory, hooksDirectory, emptyHooksDirectory]) {
  fs.mkdirSync(directory, { recursive: true })
}

const userId = 'remoteuser00001'
const email = 'remote-user@example.test'
const password = 'test-password-12345'
const deniedUserId = 'denieduser00001'
const deniedEmail = 'denied-user@example.test'
const deniedPassword = 'denied-password-12345'

const setupMigration = `migrate(
  function (app) {
    var users = app.findCollectionByNameOrId('users')
    users.listRule = "@request.auth.id != ''"
    users.viewRule = "@request.auth.id != ''"
    users.createRule = "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin'"
    users.updateRule = "@request.auth.profile = 'admin' || @request.auth.profile = 'superadmin' || @request.auth.id = id"
    users.deleteRule = null
    users.authRule = 'ativo = true'
    users.fields.add(new SelectField({
      name: 'profile',
      values: ['admin', 'operator', 'viewer', 'superadmin'],
      maxSelect: 1,
    }))
    users.fields.add(new BoolField({ name: 'ativo', required: false }))
    app.save(users)

    var user = new Record(users)
    user.id = '${userId}'
    user.set('email', '${email}')
    user.set('password', '${password}')
    user.set('verified', true)
    user.set('profile', 'superadmin')
    user.set('ativo', true)
    app.save(user)

    var deniedUser = new Record(users)
    deniedUser.id = '${deniedUserId}'
    deniedUser.set('email', '${deniedEmail}')
    deniedUser.set('password', '${deniedPassword}')
    deniedUser.set('verified', true)
    deniedUser.set('profile', 'operator')
    deniedUser.set('ativo', true)
    app.save(deniedUser)

    var parameters = new Collection({
      type: 'base',
      name: 'system_parameters',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.profile = 'superadmin'",
      updateRule: "@request.auth.profile = 'superadmin'",
      deleteRule: "@request.auth.profile = 'superadmin'",
    })
    parameters.fields.add(new NumberField({ name: 'prazo_alerta_dias', required: true, min: 1 }))
    parameters.fields.add(new AutodateField({ name: 'created', onCreate: true, onUpdate: false }))
    parameters.fields.add(new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }))
    app.save(parameters)

    var parameter = new Record(parameters)
    parameter.set('prazo_alerta_dias', 30)
    app.save(parameter)

    var cargos = new Collection({ type: 'base', name: 'cargos' })
    cargos.fields.add(new TextField({ name: 'nome', required: true }))
    app.save(cargos)
    var cargo = new Record(cargos)
    cargo.set('nome', 'Cargo de teste')
    app.save(cargo)

    var clientes = new Collection({ type: 'base', name: 'clientes' })
    clientes.fields.add(new TextField({ name: 'nome', required: true }))
    app.save(clientes)
    var cliente = new Record(clientes)
    cliente.set('nome', 'Cliente de teste')
    app.save(cliente)

    var vacancies = new Collection({ type: 'base', name: 'vacancies' })
    for (var vacancyTextField of [
      'wordpress_job_id',
      'status_vaga',
      'data_abertura',
      'prazo_desejado',
      'responsavel_operacional',
    ]) {
      vacancies.fields.add(new TextField({ name: vacancyTextField }))
    }
    vacancies.fields.add(
      new RelationField({ name: 'cargo', collectionId: cargos.id, maxSelect: 1 }),
    )
    vacancies.fields.add(
      new RelationField({ name: 'cliente', collectionId: clientes.id, maxSelect: 1 }),
    )
    vacancies.fields.add(
      new RelationField({ name: 'responsavel_rh', collectionId: users.id, maxSelect: 1 }),
    )
    vacancies.fields.add(new NumberField({ name: 'quantidade_vagas' }))
    app.save(vacancies)
    var vacancy = new Record(vacancies)
    vacancy.set('wordpress_job_id', 'wp-runtime-1')
    vacancy.set('status_vaga', 'Aberta')
    vacancy.set('data_abertura', '2026-09-01')
    vacancy.set('prazo_desejado', '2026-10-01')
    vacancy.set('quantidade_vagas', 3)
    vacancy.set('cargo', cargo.id)
    vacancy.set('cliente', cliente.id)
    vacancy.set('responsavel_rh', user.id)
    vacancy.set('responsavel_operacional', 'Operação')
    app.save(vacancy)
    for (var vacancyIndex = 1; vacancyIndex < 501; vacancyIndex++) {
      var paginatedVacancy = new Record(vacancies)
      paginatedVacancy.set('wordpress_job_id', 'wp-runtime-' + (vacancyIndex + 1))
      paginatedVacancy.set('status_vaga', 'Aberta')
      paginatedVacancy.set('data_abertura', '2026-09-01')
      paginatedVacancy.set('prazo_desejado', '2026-10-01')
      paginatedVacancy.set('quantidade_vagas', 1)
      paginatedVacancy.set('cargo', cargo.id)
      paginatedVacancy.set('cliente', cliente.id)
      paginatedVacancy.set('responsavel_rh', user.id)
      paginatedVacancy.set('responsavel_operacional', 'Operação')
      app.save(paginatedVacancy)
    }

    var candidates = new Collection({ type: 'base', name: 'candidates' })
    candidates.fields.add(
      new RelationField({ name: 'vacancy_id', collectionId: vacancies.id, maxSelect: 1, required: true }),
    )
    candidates.fields.add(
      new SelectField({
        name: 'status_candidato',
        maxSelect: 1,
        values: [
          'Análise do RH',
          'Análise do gestor',
          'Documentação e exame',
          'Cadastro DP',
          'Integrado',
          'Desistente',
          'Desclassificado',
          'Em banco',
        ],
      }),
    )
    candidates.fields.add(new NumberField({ name: 'rank' }))
    candidates.fields.add(new TextField({ name: 'nome' }))
    candidates.fields.add(new EmailField({ name: 'email' }))
    candidates.fields.add(new TextField({ name: 'telefone' }))
    candidates.fields.add(new TextField({ name: 'cidade' }))
    candidates.fields.add(new TextField({ name: 'bairro' }))
    candidates.fields.add(new TextField({ name: 'wordpress_candidatura_id' }))
    candidates.fields.add(new TextField({ name: 'ordem_execucao' }))
    candidates.fields.add(new TextField({ name: 'observacoes' }))
    candidates.fields.add(new TextField({ name: 'cpf' }))
    app.save(candidates)
    for (var candidateIndex = 0; candidateIndex < 501; candidateIndex++) {
      var candidate = new Record(candidates)
      candidate.set('vacancy_id', vacancy.id)
      candidate.set(
        'status_candidato',
        candidateIndex % 3 === 0
          ? 'Integrado'
          : candidateIndex % 3 === 1
            ? 'Análise do RH'
            : 'Desclassificado',
      )
      candidate.set('rank', candidateIndex % 2 === 0 ? 5 : 3)
      candidate.set('nome', 'Dado pessoal permitido somente no conjunto profissional ' + candidateIndex)
      candidate.set('email', 'candidate-' + candidateIndex + '@example.test')
      candidate.set('telefone', '+55 81 90000-' + candidateIndex)
      candidate.set('cidade', 'Recife')
      candidate.set('bairro', 'Bairro permitido somente no conjunto contato ' + candidateIndex)
      candidate.set('wordpress_candidatura_id', 'wp-application-' + candidateIndex)
      candidate.set('ordem_execucao', 'OE-' + candidateIndex)
      candidate.set('observacoes', 'Observação irrestrita proibida ' + candidateIndex)
      candidate.set('cpf', '00000000000')
      app.save(candidate)
    }

    var pipelineHistory = new Collection({ type: 'base', name: 'pipeline_history' })
    pipelineHistory.fields.add(
      new RelationField({ name: 'vacancy_id', collectionId: vacancies.id, maxSelect: 1 }),
    )
    pipelineHistory.fields.add(
      new RelationField({ name: 'usuario_id', collectionId: users.id, maxSelect: 1 }),
    )
    pipelineHistory.fields.add(new TextField({ name: 'status_anterior' }))
    pipelineHistory.fields.add(new TextField({ name: 'status_novo' }))
    pipelineHistory.fields.add(new AutodateField({ name: 'data_mudanca', onCreate: true }))
    pipelineHistory.fields.add(new AutodateField({ name: 'created', onCreate: true }))
    pipelineHistory.fields.add(new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }))
    app.save(pipelineHistory)
    var pipelineEvent = new Record(pipelineHistory)
    pipelineEvent.set('vacancy_id', vacancy.id)
    pipelineEvent.set('usuario_id', user.id)
    pipelineEvent.set('status_anterior', 'Triagem')
    pipelineEvent.set('status_novo', 'Aberta')
    app.save(pipelineEvent)

    var candidateHistory = new Collection({ type: 'base', name: 'candidate_history' })
    candidateHistory.fields.add(
      new RelationField({ name: 'vacancy_id', collectionId: vacancies.id, maxSelect: 1 }),
    )
    candidateHistory.fields.add(
      new RelationField({ name: 'candidate_id', collectionId: candidates.id, maxSelect: 1 }),
    )
    candidateHistory.fields.add(
      new RelationField({ name: 'usuario_id', collectionId: users.id, maxSelect: 1 }),
    )
    candidateHistory.fields.add(new TextField({ name: 'status_anterior' }))
    candidateHistory.fields.add(new TextField({ name: 'status_novo' }))
    candidateHistory.fields.add(new AutodateField({ name: 'data_mudanca', onCreate: true }))
    candidateHistory.fields.add(new AutodateField({ name: 'created', onCreate: true }))
    candidateHistory.fields.add(new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }))
    app.save(candidateHistory)
    var candidateEvent = new Record(candidateHistory)
    candidateEvent.set('vacancy_id', vacancy.id)
    candidateEvent.set('candidate_id', app.findFirstRecordByFilter('candidates', 'wordpress_candidatura_id = "wp-application-0"').id)
    candidateEvent.set('usuario_id', user.id)
    candidateEvent.set('status_anterior', 'Análise do RH')
    candidateEvent.set('status_novo', 'Integrado')
    app.save(candidateEvent)

    var settings = app.settings()
    settings.trustedProxy.headers = ['X-Test-Client-IP']
    settings.trustedProxy.useLeftmostIP = true
    app.save(settings)
  },
  function (_) {},
)`
fs.writeFileSync(
  path.join(migrationsDirectory, '0077_remote_auth_runtime_setup.js'),
  setupMigration,
)
fs.copyFileSync(
  path.join(ROOT, 'pocketbase', 'migrations', '0078_add_remote_access_control.js'),
  path.join(migrationsDirectory, '0078_add_remote_access_control.js'),
)
const accessSecret = 'runtime-test-access-secret'
const integrationSecret = 'runtime-test-iris-integration-secret'
const consultativeSecret =
  process.env.TEST_CONSULTATIVE_SECRET || 'runtime-test-rh-consultative-secret'
const irisRhReportSecret = 'runtime-test-iris-rh-reporting-secret-unique'
const consultativeRuntimeEnvironment = process.env.TEST_CONSULTATIVE_RUNTIME_ENV || 'preview'
const consultativeShouldBeDisabled = process.env.TEST_CONSULTATIVE_EXPECT_DISABLED === 'true'
const trustedProxyIps = process.env.TEST_TRUSTED_PROXY_IPS || '10.0.0.1'
const mailRequests = []
let mailResponseStatus = 200

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close((error) => {
        if (error) reject(error)
        else resolve(address.port)
      })
    })
  })
}

function request(url, options = {}, body) {
  return new Promise((resolve, reject) => {
    const target = new URL(url)
    const payload = body === undefined ? null : JSON.stringify(body)
    const req = http.request(
      target,
      {
        method: options.method || 'GET',
        headers: {
          ...(payload
            ? {
                'content-type': 'application/json',
                'content-length': Buffer.byteLength(payload),
              }
            : {}),
          ...(options.headers || {}),
        },
      },
      (res) => {
        let raw = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          raw += chunk
        })
        res.on('end', () => {
          let parsed = null
          try {
            parsed = raw ? JSON.parse(raw) : null
          } catch (_) {}
          resolve({
            status: res.statusCode,
            body: parsed,
            raw,
            headers: res.headers,
          })
        })
      },
    )
    req.once('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(',')}}`
}

async function waitForReady(baseUrl, server, output) {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`PocketBase exited\n${output()}`)
    try {
      const health = await request(`${baseUrl}/api/health`)
      if (health.status === 200) return
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`PocketBase did not become ready\n${output()}`)
}

async function stopServer(server) {
  if (!server || server.exitCode !== null) return
  server.kill('SIGTERM')
  await Promise.race([
    new Promise((resolve) => server.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 3_000)),
  ])
  if (server.exitCode === null) server.kill('SIGKILL')
}

function startMailServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let raw = ''
      req.setEncoding('utf8')
      req.on('data', (chunk) => {
        raw += chunk
      })
      req.on('end', () => {
        let body = null
        try {
          body = raw ? JSON.parse(raw) : null
        } catch (_) {}
        mailRequests.push({ method: req.method, url: req.url, body, raw })
        res.writeHead(mailResponseStatus, {
          'content-type': 'application/json',
        })
        res.end(JSON.stringify({ id: 'runtime-mail-1' }))
      })
    })
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

async function main() {
  const mailServer = await startMailServer()
  const mailAddress = mailServer.address()
  const hookSource = fs
    .readFileSync(path.join(ROOT, 'pocketbase', 'hooks', 'enforce_user_ativo.js'), 'utf8')
    .replaceAll("$secrets.get('GV_RH_ACCESS_HMAC_SECRET') || ''", JSON.stringify(accessSecret))
    .replaceAll(
      "$secrets.get('PMAIS_IRIS_GV_HMAC_SECRET') || ''",
      JSON.stringify(integrationSecret),
    )
    .replaceAll(
      "$secrets.get('PMAIS_RH_CONSULTIVO_GV_PREVIEW_HMAC_SECRET') || ''",
      JSON.stringify(consultativeSecret),
    )
    .replaceAll(
      "$secrets.get('PMAIS_IRIS_RH_REPORT_HMAC_SECRET') || ''",
      JSON.stringify(irisRhReportSecret),
    )
    .replaceAll(
      "$secrets.get('PMAIS_RH_CONSULTIVO_GV_RUNTIME_ENV') || ''",
      JSON.stringify(consultativeRuntimeEnvironment),
    )
    .replaceAll(
      "$secrets.get('PMAIS_RH_CONSULTIVO_GV_PREVIEW_ENABLED') || ''",
      JSON.stringify('true'),
    )
    .replaceAll("$secrets.get('GV_RH_IP_DIAGNOSTIC_ENABLED') || ''", JSON.stringify('true'))
    .replaceAll("$secrets.get('GV_RH_TRUSTED_PROXY_IPS') || ''", JSON.stringify(trustedProxyIps))
    .replaceAll("$secrets.get('RESEND_API_KEY') || ''", JSON.stringify('runtime-resend-key'))
    .replaceAll("$secrets.get('WORDPRESS_INTEGRATION_TOKEN') || ''", JSON.stringify('runtime-wordpress-integration-token'))
    .replaceAll("$secrets.get('WORDPRESS_CLOSED_VACANCY_OVERRIDE_TOKEN') || ''", JSON.stringify('runtime-wordpress-override-token'))
    .replaceAll("$secrets.get('PMAIS_IRIS_GV_PROOF_SECRET') || ''", JSON.stringify('runtime-iris-proof-secret'))
    .replaceAll("$secrets.get('PMAIS_IRIS_GV_API_KEY') || ''", JSON.stringify('runtime-iris-api-key'))
    .replaceAll("$secrets.get('ESCAVADOR_API_TOKEN') || ''", JSON.stringify('runtime-escavador-token'))
    .replaceAll('https://api.resend.com/emails', `http://127.0.0.1:${mailAddress.port}/emails`)
  fs.writeFileSync(path.join(hooksDirectory, 'enforce_user_ativo.pb.js'), hookSource)
  fs.copyFileSync(
    path.join(ROOT, 'pocketbase', 'hooks', 'enforce_profile_update.js'),
    path.join(hooksDirectory, 'enforce_profile_update.pb.js'),
  )
  const feedbackCommitSource = fs
    .readFileSync(path.join(ROOT, 'pocketbase', 'hooks', 'curriculum_feedback_commit.js'), 'utf8')
    .replaceAll(
      "$secrets.get('PMAIS_IRIS_GV_HMAC_SECRET') || ''",
      JSON.stringify(integrationSecret),
    )
  fs.writeFileSync(
    path.join(hooksDirectory, 'curriculum_feedback_commit.pb.js'),
    feedbackCommitSource,
  )
  fs.writeFileSync(
    path.join(hooksDirectory, 'remote_access_test_probe.pb.js'),
    `routerAdd('POST', '/test/challenges/{id}/allow-resend', (e) => {
  var record = $app.findRecordById('remote_access_challenges', e.request.pathValue('id'))
  record.set('resend_after', 1)
  $app.save(record)
  return e.json(200, { ok: true })
})
routerAdd('POST', '/test/sessions/expire', (e) => {
  var authorization = e.request.header.get('Authorization') || ''
  var token = authorization.replace(/^Bearer\\s+/i, '').trim()
  var digest = $security.hs256(token, '${accessSecret}')
  var sessions = $app.findRecordsByFilter(
    'remote_access_sessions',
    'token_digest = {:digest}',
    '',
    1,
    0,
    { digest: digest },
  )
  if (sessions.length !== 1) throw e.notFoundError('Session not found.', null)
  sessions[0].set('expires_at', 1)
  $app.save(sessions[0])
  return e.json(200, { ok: true })
})
routerAdd('POST', '/test/rate-limit/saturate', (e) => {
  var keyDigest = $security.hs256('login:' + e.remoteIP(), '${accessSecret}')
  var records = $app.findRecordsByFilter(
    'remote_access_rate_limits',
    'key_digest = {:key}',
    '',
    1,
    0,
    { key: keyDigest },
  )
  var record = records.length === 1
    ? records[0]
    : new Record($app.findCollectionByNameOrId('remote_access_rate_limits'))
  record.set('key_digest', keyDigest)
  record.set('window_start', Math.floor(Date.now() / 1000))
  record.set('request_count', 300)
  record.set('blocked_until', 0)
  $app.save(record)
  return e.json(200, { ok: true })
})
routerAdd('POST', '/test/cargos/rename', (e) => {
  var collection = $app.findCollectionByNameOrId('cargos')
  collection.name = 'cargos_unavailable'
  $app.save(collection)
  return e.json(200, { ok: true })
})
routerAdd('GET', '/test/audit', (e) => {
  var records = $app.findRecordsByFilter('remote_access_audit', '', 'created', 500, 0)
  return e.json(200, {
    items: records.map(function (record) {
      return {
        event: record.getString('event'),
        actor: record.getString('actor'),
        targetUser: record.getString('target_user'),
        result: record.getString('result'),
        details: record.getString('details'),
      }
    }),
  })
})\n`,
  )

  const migration = spawnSync(
    POCKETBASE,
    [
      'migrate',
      'up',
      '--dir',
      dataDirectory,
      '--migrationsDir',
      migrationsDirectory,
      '--hooksDir',
      emptyHooksDirectory,
      '--dev=false',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  )
  assert.equal(
    migration.status,
    0,
    `PocketBase migration failed\n${migration.stdout || ''}${migration.stderr || ''}`,
  )

  const port = await reservePort()
  const baseUrl = `http://127.0.0.1:${port}`
  const server = spawn(
    POCKETBASE,
    [
      'serve',
      `--http=127.0.0.1:${port}`,
      '--dir',
      dataDirectory,
      '--migrationsDir',
      migrationsDirectory,
      '--hooksDir',
      hooksDirectory,
      '--dev=true',
    ],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  let stdout = ''
  let stderr = ''
  server.stdout.on('data', (chunk) => {
    stdout += chunk
  })
  server.stderr.on('data', (chunk) => {
    stderr += chunk
  })
  const output = () => `${stdout}${stderr}`

  try {
    await waitForReady(baseUrl, server, output)

    const reportingPath = '/backend/v1/access/integrations/iris/rh-reporting/snapshot'
    const signedReportingCall = async (body, timestampOffset = 0, secret = irisRhReportSecret) => {
      const timestamp = String(Math.floor(Date.now() / 1000) + timestampOffset)
      const signature = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}\nPOST\n${reportingPath}\n${canonicalJson(body)}`)
        .digest('hex')
      return request(
        `${baseUrl}${reportingPath}`,
        {
          method: 'POST',
          headers: {
            'X-PMais-Iris-RH-Reporting-Timestamp': timestamp,
            'X-PMais-Iris-RH-Reporting-Signature': signature,
          },
        },
        body,
      )
    }

    const reportingBody = {
      request_version: 1,
      resources: ['vacancies', 'candidates', 'pipeline_history', 'candidate_history'],
    }
    const unsignedReporting = await request(
      `${baseUrl}${reportingPath}`,
      { method: 'POST', headers: { Authorization: 'Bearer generic-token-must-not-authorize' } },
      reportingBody,
    )
    assert.equal(unsignedReporting.status, 403, unsignedReporting.raw)
    assert.equal(unsignedReporting.body.code, 'iris_rh_reporting_snapshot_unauthorized')
    const staleReporting = await signedReportingCall(reportingBody, -61)
    assert.equal(staleReporting.status, 403, staleReporting.raw)
    const wrongSecretReporting = await signedReportingCall(reportingBody, 0, integrationSecret)
    assert.equal(wrongSecretReporting.status, 403, wrongSecretReporting.raw)
    const invalidResourceReporting = await signedReportingCall({
      request_version: 1,
      resources: ['users'],
    })
    assert.equal(invalidResourceReporting.status, 403, invalidResourceReporting.raw)
    for (const inheritedResource of ['toString', 'constructor', '__proto__']) {
      const inheritedResourceReporting = await signedReportingCall({
        request_version: 1,
        resources: [inheritedResource],
      })
      assert.equal(
        inheritedResourceReporting.status,
        403,
        `${inheritedResource}: ${inheritedResourceReporting.raw}`,
      )
    }
    for (const invalidFieldSet of ['', null, false, 0]) {
      const invalidFieldSetReporting = await signedReportingCall({
        candidate_field_set: invalidFieldSet,
        request_version: 1,
        resources: ['candidates'],
      })
      assert.equal(
        invalidFieldSetReporting.status,
        403,
        `${JSON.stringify(invalidFieldSet)}: ${invalidFieldSetReporting.raw}`,
      )
    }

    const professionalReporting = await signedReportingCall(reportingBody)
    assert.equal(professionalReporting.status, 200, `${professionalReporting.raw}\n${output()}`)
    assert.equal(professionalReporting.headers['cache-control'], 'no-store')
    assert.deepEqual(Object.keys(professionalReporting.body).sort(), [
      'generated_at',
      'resources',
      'schema_version',
    ])
    assert.deepEqual(Object.keys(professionalReporting.body.resources).sort(), [
      'candidate_history',
      'candidates',
      'pipeline_history',
      'vacancies',
    ])
    assert.equal(professionalReporting.body.resources.vacancies.length, 501)
    assert.equal(professionalReporting.body.resources.candidates.length, 501)
    assert.equal(professionalReporting.body.resources.pipeline_history.length, 1)
    assert.equal(professionalReporting.body.resources.candidate_history.length, 1)
    assert.equal(professionalReporting.body.resources.pipeline_history[0].new_status, 'Aberta')
    assert.equal(professionalReporting.body.resources.candidate_history[0].new_status, 'Integrado')
    const professionalCandidate = professionalReporting.body.resources.candidates.find(
      (item) => item.wordpress_application_id === 'wp-application-0',
    )
    assert.ok(professionalCandidate)
    assert.equal(professionalCandidate.name.includes('conjunto profissional'), true)
    assert.equal(professionalCandidate.vacancy_id.length > 0, true)
    assert.equal(Object.hasOwn(professionalCandidate, 'email'), false)
    assert.equal(Object.hasOwn(professionalCandidate, 'phone'), false)
    assert.equal(Object.hasOwn(professionalCandidate, 'city'), false)
    assert.equal(Object.hasOwn(professionalCandidate, 'bairro'), false)
    assert.deepEqual(
      [...new Set(professionalReporting.body.resources.candidates.map((item) => item.status))].sort(),
      ['Análise do RH', 'Desclassificado', 'Integrado'].sort(),
    )
    const professionalJson = JSON.stringify(professionalReporting.body)
    for (const forbiddenValue of [
      '@example.test',
      '+55 81',
      'Bairro permitido',
      '00000000000',
      'Observação irrestrita proibida',
    ]) {
      assert.equal(professionalJson.includes(forbiddenValue), false, forbiddenValue)
    }
    const forbiddenKeys = new Set([
      'cpf',
      'rg',
      'full_address',
      'data_nascimento',
      'nome_pai',
      'nome_mae',
      'telefone_emergencia',
      'tamanho_fardamento',
      'tamanho_sapato',
      'observacao',
      'observacoes',
      'informacoes_integracao',
      'resume',
      'curriculo',
    ])
    const assertNoForbiddenKeys = (value) => {
      if (Array.isArray(value)) {
        for (const item of value) assertNoForbiddenKeys(item)
        return
      }
      if (!value || typeof value !== 'object') return
      for (const [key, child] of Object.entries(value)) {
        assert.equal(forbiddenKeys.has(key), false, key)
        assertNoForbiddenKeys(child)
      }
    }
    assertNoForbiddenKeys(professionalReporting.body)

    const contactReporting = await signedReportingCall({
      candidate_field_set: 'contact',
      request_version: 1,
      resources: ['candidates'],
    })
    assert.equal(contactReporting.status, 200, contactReporting.raw)
    assert.deepEqual(Object.keys(contactReporting.body.resources), ['candidates'])
    assert.equal(contactReporting.body.resources.candidates.length, 501)
    const contactCandidate = contactReporting.body.resources.candidates.find(
      (item) => item.wordpress_application_id === 'wp-application-0',
    )
    assert.equal(contactCandidate.email, 'candidate-0@example.test')
    assert.equal(contactCandidate.phone, '+55 81 90000-0')
    assert.equal(contactCandidate.city, 'Recife')
    assert.equal(contactCandidate.bairro, 'Bairro permitido somente no conjunto contato 0')
    assertNoForbiddenKeys(contactReporting.body)
    assert.equal(JSON.stringify(contactReporting.body).includes('00000000000'), false)
    assert.equal(JSON.stringify(contactReporting.body).includes('Observação irrestrita proibida'), false)

    const afterReporting = await signedReportingCall(reportingBody)
    assert.equal(afterReporting.status, 200, afterReporting.raw)
    assert.equal(afterReporting.body.resources.vacancies.length, 501)
    assert.equal(afterReporting.body.resources.candidates.length, 501)
    assert.equal(afterReporting.body.resources.pipeline_history.length, 1)
    assert.equal(afterReporting.body.resources.candidate_history.length, 1)

    const consultativePath = '/backend/v1/access/integrations/pmais-rh-consultivo/snapshot'
    const consultativeBody = { request_version: 1 }
    if (consultativeShouldBeDisabled) {
      const disabledConsultative = await request(
        `${baseUrl}${consultativePath}`,
        { method: 'POST' },
        consultativeBody,
      )
      assert.equal(disabledConsultative.status, 404, disabledConsultative.raw)
    } else {
      const unsignedConsultative = await request(
        `${baseUrl}${consultativePath}`,
        { method: 'POST' },
        consultativeBody,
      )
      assert.equal(unsignedConsultative.status, 403, unsignedConsultative.raw)
      assert.equal(unsignedConsultative.body.code, 'consultative_snapshot_unauthorized')

      const irisSignedTimestamp = String(Math.floor(Date.now() / 1000))
      const irisSignedSignature = crypto
        .createHmac('sha256', integrationSecret)
        .update(
          `${irisSignedTimestamp}\nPOST\n${consultativePath}\n${JSON.stringify(consultativeBody)}`,
        )
        .digest('hex')
      const irisSignedConsultative = await request(
        `${baseUrl}${consultativePath}`,
        {
          method: 'POST',
          headers: {
            'X-PMais-Consultivo-Timestamp': irisSignedTimestamp,
            'X-PMais-Consultivo-Signature': irisSignedSignature,
          },
        },
        consultativeBody,
      )
      assert.equal(irisSignedConsultative.status, 403, irisSignedConsultative.raw)

      const staleTimestamp = String(Math.floor(Date.now() / 1000) - 61)
      const staleSignature = crypto
        .createHmac('sha256', consultativeSecret)
        .update(`${staleTimestamp}\nPOST\n${consultativePath}\n${JSON.stringify(consultativeBody)}`)
        .digest('hex')
      const staleConsultative = await request(
        `${baseUrl}${consultativePath}`,
        {
          method: 'POST',
          headers: {
            'X-PMais-Consultivo-Timestamp': staleTimestamp,
            'X-PMais-Consultivo-Signature': staleSignature,
          },
        },
        consultativeBody,
      )
      assert.equal(staleConsultative.status, 403, staleConsultative.raw)

      const consultativeTimestamp = String(Math.floor(Date.now() / 1000))
      const consultativeSignature = crypto
        .createHmac('sha256', consultativeSecret)
        .update(
          `${consultativeTimestamp}\nPOST\n${consultativePath}\n${JSON.stringify(consultativeBody)}`,
        )
        .digest('hex')
      const consultativeSnapshot = await request(
        `${baseUrl}${consultativePath}`,
        {
          method: 'POST',
          headers: {
            'X-PMais-Consultivo-Timestamp': consultativeTimestamp,
            'X-PMais-Consultivo-Signature': consultativeSignature,
          },
        },
        consultativeBody,
      )
      assert.equal(consultativeSnapshot.status, 200, `${consultativeSnapshot.raw}\n${output()}`)
      assert.equal(consultativeSnapshot.headers['cache-control'], 'no-store')
      assert.deepEqual(Object.keys(consultativeSnapshot.body).sort(), [
        'generated_at',
        'schema_version',
        'totals',
        'vacancies',
      ])
      assert.deepEqual(consultativeSnapshot.body.totals, {
        vacancies_processed: 501,
        candidates_processed: 501,
      })
      assert.equal(consultativeSnapshot.body.vacancies.length, 501)
      const snapshotVacancy = consultativeSnapshot.body.vacancies.find(
        (item) => item.wordpress_job_id === 'wp-runtime-1',
      )
      assert.ok(snapshotVacancy)
      assert.equal(snapshotVacancy.cargo_nome, 'Cargo de teste')
      assert.equal(snapshotVacancy.cliente_nome, 'Cliente de teste')
      assert.equal(snapshotVacancy.candidates, 501)
      assert.deepEqual(snapshotVacancy.candidate_status_counts, {
        Integrado: 167,
        'Análise do RH': 167,
        Desclassificado: 167,
      })
      assert.equal(snapshotVacancy.priority_45, 83)
      const snapshotJson = JSON.stringify(consultativeSnapshot.body)
      for (const forbiddenValue of ['Dado pessoal proibido', 'candidate-', '00000000000']) {
        assert.equal(snapshotJson.includes(forbiddenValue), false, forbiddenValue)
      }
      const snapshotKeys = new Set()
      const collectSnapshotKeys = (value) => {
        if (Array.isArray(value)) {
          for (const item of value) collectSnapshotKeys(item)
          return
        }
        if (!value || typeof value !== 'object') return
        for (const [key, child] of Object.entries(value)) {
          snapshotKeys.add(key)
          collectSnapshotKeys(child)
        }
      }
      collectSnapshotKeys(consultativeSnapshot.body)
      for (const forbiddenKey of [
        'nome',
        'email',
        'telefone',
        'cpf',
        'rg',
        'data_nascimento',
        'bairro',
        'observacao',
        'observacoes',
        'informacoes_integracao',
        'expand',
      ]) {
        assert.equal(snapshotKeys.has(forbiddenKey), false, forbiddenKey)
      }

      const renameCargoCollection = await request(`${baseUrl}/test/cargos/rename`, {
        method: 'POST',
      })
      assert.equal(renameCargoCollection.status, 200, renameCargoCollection.raw)
      const unavailableTimestamp = String(Math.floor(Date.now() / 1000))
      const unavailableSignature = crypto
        .createHmac('sha256', consultativeSecret)
        .update(
          `${unavailableTimestamp}\nPOST\n${consultativePath}\n${JSON.stringify(consultativeBody)}`,
        )
        .digest('hex')
      const unavailableSnapshot = await request(
        `${baseUrl}${consultativePath}`,
        {
          method: 'POST',
          headers: {
            'X-PMais-Consultivo-Timestamp': unavailableTimestamp,
            'X-PMais-Consultivo-Signature': unavailableSignature,
          },
        },
        consultativeBody,
      )
      assert.equal(unavailableSnapshot.status, 503, unavailableSnapshot.raw)
      assert.equal(Object.hasOwn(unavailableSnapshot.body || {}, 'vacancies'), false)
    }

    const login = await request(
      `${baseUrl}/backend/v1/access/login`,
      { method: 'POST' },
      { identity: email, password },
    )
    assert.equal(login.status, 200, `custom login failed: ${login.raw}\n${output()}`)
    assert.equal(typeof login.body.token, 'string')
    assert.ok(login.body.token.length > 20)
    assert.equal(login.body.record.id, userId)

    const protectedRead = await request(`${baseUrl}/api/collections/system_parameters/records`, {
      headers: { Authorization: login.body.token },
    })
    assert.equal(protectedRead.status, 200, protectedRead.raw)
    assert.equal(protectedRead.body.items.length, 1)

    const createSecurityBaseline = await request(
      `${baseUrl}/api/collections/system_parameters/records`,
      { method: 'POST', headers: { Authorization: login.body.token } },
      { prazo_alerta_dias: 31 },
    )
    assert.equal(createSecurityBaseline.status, 403, createSecurityBaseline.raw)
    const parameterId = protectedRead.body.items[0].id
    const deleteSecurityBaseline = await request(
      `${baseUrl}/api/collections/system_parameters/records/${parameterId}`,
      { method: 'DELETE', headers: { Authorization: login.body.token } },
    )
    assert.equal(deleteSecurityBaseline.status, 403, deleteSecurityBaseline.raw)

    const operatorLogin = await request(
      `${baseUrl}/backend/v1/access/login`,
      { method: 'POST' },
      { identity: deniedEmail, password: deniedPassword },
    )
    assert.equal(operatorLogin.status, 200, operatorLogin.raw)

    const createdWithRemotePermission = await request(
      `${baseUrl}/api/collections/users/records`,
      { method: 'POST', headers: { Authorization: login.body.token } },
      {
        email: 'new-user@example.test',
        password: 'new-user-password-12345',
        passwordConfirm: 'new-user-password-12345',
        profile: 'operator',
        ativo: true,
        permitir_acesso_fora_pmais: true,
      },
    )
    assert.equal(createdWithRemotePermission.status, 200, createdWithRemotePermission.raw)
    assert.equal(createdWithRemotePermission.body.permitir_acesso_fora_pmais, false)
    const createdUserLogin = await request(
      `${baseUrl}/backend/v1/access/login`,
      { method: 'POST' },
      {
        identity: 'new-user@example.test',
        password: 'new-user-password-12345',
      },
    )
    assert.equal(createdUserLogin.status, 200, createdUserLogin.raw)
    const inactiveUserToken = createdUserLogin.body.token
    const directDeactivate = await request(
      `${baseUrl}/api/collections/users/records/${createdWithRemotePermission.body.id}`,
      { method: 'PATCH', headers: { Authorization: login.body.token } },
      { ativo: false },
    )
    assert.equal(directDeactivate.status, 403, directDeactivate.raw)
    const deactivateCreatedUser = await request(
      `${baseUrl}/backend/v1/access/users/${createdWithRemotePermission.body.id}/active-status`,
      { method: 'PUT', headers: { Authorization: login.body.token } },
      { active: false },
    )
    assert.equal(deactivateCreatedUser.status, 200, `${deactivateCreatedUser.raw}\n${output()}`)

    const diagnostic = await request(`${baseUrl}/backend/v1/access/ip-diagnostic`, {
      headers: { Authorization: login.body.token },
    })
    assert.equal(diagnostic.status, 200, diagnostic.raw)
    assert.equal(typeof diagnostic.body.remoteIp, 'string')
    assert.equal(typeof diagnostic.body.realIp, 'string')
    assert.equal(diagnostic.body.restrictionEnabled, false)
    const forwardedDiagnostic = await request(`${baseUrl}/backend/v1/access/ip-diagnostic`, {
      headers: {
        Authorization: login.body.token,
        'X-Test-Client-IP': '143.208.130.134',
      },
    })
    assert.equal(forwardedDiagnostic.status, 200, forwardedDiagnostic.raw)
    assert.equal(forwardedDiagnostic.body.realIp, '143.208.130.134')
    assert.equal(forwardedDiagnostic.body.remoteIp, '127.0.0.1')
    const deniedDiagnostic = await request(`${baseUrl}/backend/v1/access/ip-diagnostic`, {
      headers: { Authorization: operatorLogin.body.token },
    })
    assert.equal(deniedDiagnostic.status, 403, deniedDiagnostic.raw)

    const selfRemoteEscalation = await request(
      `${baseUrl}/api/collections/users/records/${deniedUserId}`,
      { method: 'PATCH', headers: { Authorization: operatorLogin.body.token } },
      { permitir_acesso_fora_pmais: true },
    )
    assert.equal(selfRemoteEscalation.status, 403, selfRemoteEscalation.raw)
    const selfProfileEscalation = await request(
      `${baseUrl}/api/collections/users/records/${deniedUserId}`,
      { method: 'PATCH', headers: { Authorization: operatorLogin.body.token } },
      { profile: 'superadmin' },
    )
    assert.equal(selfProfileEscalation.status, 403, selfProfileEscalation.raw)

    const directSuperadminGrant = await request(
      `${baseUrl}/api/collections/users/records/${userId}`,
      { method: 'PATCH', headers: { Authorization: login.body.token } },
      { permitir_acesso_fora_pmais: true },
    )
    assert.equal(directSuperadminGrant.status, 403, directSuperadminGrant.raw)

    const permitRemote = await request(
      `${baseUrl}/backend/v1/access/users/${userId}/remote-permission`,
      { method: 'PUT', headers: { Authorization: login.body.token } },
      { allowed: true },
    )
    assert.equal(permitRemote.status, 200, `${permitRemote.raw}\n${output()}`)

    const directRestrictionEnable = await request(
      `${baseUrl}/api/collections/system_parameters/records/${parameterId}`,
      { method: 'PATCH', headers: { Authorization: login.body.token } },
      { restringir_acesso_fora_pmais: true },
    )
    assert.equal(directRestrictionEnable.status, 403, directRestrictionEnable.raw)

    const enableRestriction = await request(
      `${baseUrl}/backend/v1/access/settings`,
      { method: 'PUT', headers: { Authorization: login.body.token } },
      {
        restrictionEnabled: true,
        officeNetworks: ['143.208.130.134/32'],
      },
    )
    assert.equal(enableRestriction.status, 200, enableRestriction.raw)
    assert.equal(enableRestriction.body.restrictionEnabled, true)

    const preexistingSessionRead = await request(
      `${baseUrl}/api/collections/system_parameters/records`,
      { headers: { Authorization: login.body.token } },
    )
    assert.equal(preexistingSessionRead.status, 403, preexistingSessionRead.raw)
    assert.equal(preexistingSessionRead.body.code, 'remote_access_unauthorized')
    assert.equal(preexistingSessionRead.body.message, 'Acesso remoto não autorizado')

    const unsignedIntegrationSession = await request(
      `${baseUrl}/backend/v1/access/integration/session`,
      { headers: { Authorization: login.body.token } },
    )
    assert.equal(unsignedIntegrationSession.status, 403, unsignedIntegrationSession.raw)
    const integrationTimestamp = String(Math.floor(Date.now() / 1000))
    const integrationPath = '/backend/v1/access/integration/session'
    const integrationSignature = crypto
      .createHmac('sha256', integrationSecret)
      .update(`${integrationTimestamp}\nGET\n${integrationPath}`)
      .digest('hex')
    const signedIntegrationSession = await request(`${baseUrl}${integrationPath}`, {
      headers: {
        Authorization: login.body.token,
        'X-PMais-Integration-Timestamp': integrationTimestamp,
        'X-PMais-Integration-Signature': integrationSignature,
      },
    })
    assert.equal(signedIntegrationSession.status, 200, signedIntegrationSession.raw)
    assert.equal(signedIntegrationSession.body.record.id, userId)

    const signedUserPath = `/api/collections/users/records/${userId}?expand=departamento`
    const signedUserTimestamp = String(Math.floor(Date.now() / 1000))
    const signedUserSignature = crypto
      .createHmac('sha256', integrationSecret)
      .update(`${signedUserTimestamp}\nGET\n${signedUserPath}`)
      .digest('hex')
    const signedUserRead = await request(`${baseUrl}${signedUserPath}`, {
      headers: {
        Authorization: login.body.token,
        'X-PMais-Integration-Timestamp': signedUserTimestamp,
        'X-PMais-Integration-Signature': signedUserSignature,
      },
    })
    assert.equal(signedUserRead.status, 200, signedUserRead.raw)
    assert.equal(signedUserRead.body.id, userId)

    const inactiveSignedPath = `/api/collections/users/records/${createdWithRemotePermission.body.id}`
    const inactiveSignedTimestamp = String(Math.floor(Date.now() / 1000))
    const inactiveSignedSignature = crypto
      .createHmac('sha256', integrationSecret)
      .update(`${inactiveSignedTimestamp}\nGET\n${inactiveSignedPath}`)
      .digest('hex')
    const inactiveSignedRead = await request(`${baseUrl}${inactiveSignedPath}`, {
      headers: {
        Authorization: inactiveUserToken,
        'X-PMais-Integration-Timestamp': inactiveSignedTimestamp,
        'X-PMais-Integration-Signature': inactiveSignedSignature,
      },
    })
    assert.equal(inactiveSignedRead.status, 403, inactiveSignedRead.raw)
    assert.equal(inactiveSignedRead.body.code, 'remote_access_unauthorized')

    const unsignedCommit = await request(
      `${baseUrl}/backend/v1/curriculum-feedback/commit`,
      { method: 'POST', headers: { Authorization: login.body.token } },
      {},
    )
    assert.equal(unsignedCommit.status, 403, unsignedCommit.raw)
    assert.equal(unsignedCommit.body.code, 'remote_access_unauthorized')
    const commitTimestamp = String(Math.floor(Date.now() / 1000))
    const commitSignature = crypto
      .createHmac('sha256', integrationSecret)
      .update(`${commitTimestamp}.{}`)
      .digest('hex')
    const signedCommit = await request(
      `${baseUrl}/backend/v1/curriculum-feedback/commit`,
      {
        method: 'POST',
        headers: {
          Authorization: login.body.token,
          'X-PMais-Timestamp': commitTimestamp,
          'X-PMais-Signature': commitSignature,
        },
      },
      {},
    )
    assert.notEqual(signedCommit.status, 403, signedCommit.raw)

    const externalRefresh = await request(`${baseUrl}/api/collections/users/auth-refresh`, {
      method: 'POST',
      headers: { Authorization: login.body.token },
    })
    assert.equal(externalRefresh.status, 403, `${externalRefresh.raw}\n${output()}`)
    assert.equal(externalRefresh.body.code, 'remote_access_unauthorized')
    assert.equal(externalRefresh.body.message, 'Acesso remoto não autorizado')

    const spoofedOfficeLogin = await request(
      `${baseUrl}/backend/v1/access/login`,
      { method: 'POST', headers: { 'X-Test-Client-IP': '143.208.130.134' } },
      { identity: deniedEmail, password: deniedPassword },
    )
    if (trustedProxyIps === '127.0.0.1') {
      assert.equal(spoofedOfficeLogin.status, 200, spoofedOfficeLogin.raw)
      assert.ok(spoofedOfficeLogin.body.token)
      const officeRefresh = await request(`${baseUrl}/api/collections/users/auth-refresh`, {
        method: 'POST',
        headers: {
          Authorization: spoofedOfficeLogin.body.token,
          'X-Test-Client-IP': '143.208.130.134',
        },
      })
      assert.equal(officeRefresh.status, 200, officeRefresh.raw)
    } else {
      assert.equal(spoofedOfficeLogin.status, 403, spoofedOfficeLogin.raw)
      assert.equal(spoofedOfficeLogin.body.code, 'remote_access_unauthorized')
    }

    const nativePasswordBypass = await request(
      `${baseUrl}/api/collections/users/auth-with-password`,
      { method: 'POST' },
      { identity: email, password },
    )
    assert.equal(nativePasswordBypass.status, 403, nativePasswordBypass.raw)
    assert.equal(nativePasswordBypass.body.code, 'remote_access_unauthorized')
    assert.equal(nativePasswordBypass.body.message, 'Acesso remoto não autorizado')

    const deniedRemoteLogin = await request(
      `${baseUrl}/backend/v1/access/login`,
      { method: 'POST' },
      { identity: deniedEmail, password: deniedPassword },
    )
    assert.equal(deniedRemoteLogin.status, 403, deniedRemoteLogin.raw)
    assert.equal(deniedRemoteLogin.body.code, 'remote_access_unauthorized')
    assert.equal(deniedRemoteLogin.body.message, 'Acesso remoto não autorizado')

    mailResponseStatus = 503
    const mailFailureLogin = await request(
      `${baseUrl}/backend/v1/access/login`,
      { method: 'POST' },
      { identity: email, password },
    )
    assert.equal(mailFailureLogin.status, 503, mailFailureLogin.raw)
    assert.equal(Object.hasOwn(mailFailureLogin.body, 'token'), false)
    mailResponseStatus = 200
    mailRequests.length = 0

    const [remoteChallenge, concurrentChallenge] = await Promise.all([
      request(
        `${baseUrl}/backend/v1/access/login`,
        { method: 'POST' },
        { identity: email, password },
      ),
      request(
        `${baseUrl}/backend/v1/access/login`,
        { method: 'POST' },
        { identity: email, password },
      ),
    ])
    assert.equal(remoteChallenge.status, 202, remoteChallenge.raw)
    assert.equal(concurrentChallenge.status, 202, concurrentChallenge.raw)
    assert.equal(concurrentChallenge.body.challengeId, remoteChallenge.body.challengeId)
    assert.equal(remoteChallenge.body.type, 'remote_mfa_required')
    assert.equal(typeof remoteChallenge.body.challengeId, 'string')
    assert.ok(remoteChallenge.body.challengeId.length > 10)
    assert.equal(remoteChallenge.body.maskedEmail, 'r***@example.test')
    assert.equal(remoteChallenge.body.expiresIn, 300)
    assert.equal(remoteChallenge.body.resendAfter, 60)
    assert.equal(Object.hasOwn(remoteChallenge.body, 'token'), false)
    assert.equal(mailRequests.length, 1)
    assert.deepEqual(mailRequests[0].body.to, [email])
    assert.match(mailRequests[0].body.html, /\b\d{6}\b/)
    assert.equal(mailRequests[0].body.html.includes(password), false)
    const code = mailRequests[0].body.html.match(/\b\d{6}\b/)[0]

    const earlyResend = await request(
      `${baseUrl}/backend/v1/access/resend`,
      { method: 'POST' },
      { challengeId: remoteChallenge.body.challengeId },
    )
    assert.equal(earlyResend.status, 429, earlyResend.raw)
    assert.equal(mailRequests.length, 1)

    const wrongAttempt = await request(
      `${baseUrl}/backend/v1/access/verify`,
      { method: 'POST' },
      {
        challengeId: remoteChallenge.body.challengeId,
        code: code === '000000' ? '111111' : '000000',
      },
    )
    assert.equal(wrongAttempt.status, 400, wrongAttempt.raw)

    const verified = await request(
      `${baseUrl}/backend/v1/access/verify`,
      { method: 'POST' },
      { challengeId: remoteChallenge.body.challengeId, code },
    )
    assert.equal(verified.status, 200, `${verified.raw}\n${output()}`)
    assert.equal(typeof verified.body.token, 'string')
    assert.ok(verified.body.token.length > 20)
    assert.equal(verified.body.record.id, userId)

    const replay = await request(
      `${baseUrl}/backend/v1/access/verify`,
      { method: 'POST' },
      { challengeId: remoteChallenge.body.challengeId, code },
    )
    assert.equal(replay.status, 400, replay.raw)

    const remoteProtectedRead = await request(
      `${baseUrl}/api/collections/system_parameters/records`,
      { headers: { Authorization: verified.body.token } },
    )
    assert.equal(remoteProtectedRead.status, 200, remoteProtectedRead.raw)

    const sessionState = await request(`${baseUrl}/backend/v1/access/session`, {
      headers: { Authorization: verified.body.token },
    })
    assert.equal(sessionState.status, 200, sessionState.raw)
    assert.equal(sessionState.body.record.id, userId)

    const reactivateCreatedUser = await request(
      `${baseUrl}/backend/v1/access/users/${createdWithRemotePermission.body.id}/active-status`,
      { method: 'PUT', headers: { Authorization: verified.body.token } },
      { active: true },
    )
    assert.equal(reactivateCreatedUser.status, 200, reactivateCreatedUser.raw)

    const expireSession = await request(`${baseUrl}/test/sessions/expire`, {
      method: 'POST',
      headers: { Authorization: verified.body.token },
    })
    assert.equal(expireSession.status, 200, expireSession.raw)
    const expiredSessionRead = await request(
      `${baseUrl}/api/collections/system_parameters/records`,
      { headers: { Authorization: verified.body.token } },
    )
    assert.equal(expiredSessionRead.status, 403, expiredSessionRead.raw)
    assert.equal(expiredSessionRead.body.code, 'remote_access_unauthorized')

    const lockedChallenge = await request(
      `${baseUrl}/backend/v1/access/login`,
      { method: 'POST' },
      { identity: email, password },
    )
    assert.equal(lockedChallenge.status, 202, lockedChallenge.raw)
    assert.equal(mailRequests.length, 2)
    const oldResendCode = mailRequests[1].body.html.match(/\b\d{6}\b/)[0]
    const allowResend = await request(
      `${baseUrl}/test/challenges/${lockedChallenge.body.challengeId}/allow-resend`,
      { method: 'POST' },
    )
    assert.equal(allowResend.status, 200, `${allowResend.raw}\n${output()}`)
    const resentChallenge = await request(
      `${baseUrl}/backend/v1/access/resend`,
      { method: 'POST' },
      { challengeId: lockedChallenge.body.challengeId },
    )
    assert.equal(resentChallenge.status, 202, `${resentChallenge.raw}\n${output()}`)
    assert.equal(resentChallenge.body.type, 'remote_mfa_required')
    assert.equal(mailRequests.length, 3)
    const resentHtml = String(mailRequests[2]?.body?.html || mailRequests[2]?.raw || '')
    assert.match(
      resentHtml,
      /\d{6}/,
      JSON.stringify({
        requestKeys: Object.keys(mailRequests[2] || {}),
        method: mailRequests[2]?.method,
        url: mailRequests[2]?.url,
        bodyKeys: Object.keys(mailRequests[2]?.body || {}),
        htmlLength: resentHtml.length,
      }),
    )
    const lockedCode = resentHtml.match(/\d{6}/)[0]
    const oldCodeAttempt = await request(
      `${baseUrl}/backend/v1/access/verify`,
      { method: 'POST' },
      { challengeId: lockedChallenge.body.challengeId, code: oldResendCode },
    )
    assert.equal(oldCodeAttempt.status, 400, oldCodeAttempt.raw)
    const invalidCode = lockedCode === '999999' ? '888888' : '999999'
    for (let attempt = 2; attempt <= 5; attempt += 1) {
      const failedAttempt = await request(
        `${baseUrl}/backend/v1/access/verify`,
        { method: 'POST' },
        { challengeId: lockedChallenge.body.challengeId, code: invalidCode },
      )
      assert.equal(failedAttempt.status, 400, `attempt ${attempt}: ${failedAttempt.raw}`)
    }
    const afterLockout = await request(
      `${baseUrl}/backend/v1/access/verify`,
      { method: 'POST' },
      { challengeId: lockedChallenge.body.challengeId, code: lockedCode },
    )
    assert.equal(afterLockout.status, 400, afterLockout.raw)

    const saturateRateLimit = await request(`${baseUrl}/test/rate-limit/saturate`, {
      method: 'POST',
    })
    assert.equal(saturateRateLimit.status, 200, saturateRateLimit.raw)
    const throttledLogin = await request(
      `${baseUrl}/backend/v1/access/login`,
      { method: 'POST' },
      { identity: 'missing@example.test', password: 'wrong-password' },
    )
    assert.equal(throttledLogin.status, 429, throttledLogin.raw)

    const audit = await request(`${baseUrl}/test/audit`)
    assert.equal(audit.status, 200, audit.raw)
    const events = audit.body.items.map((item) => item.event)
    for (const expectedEvent of [
      'remote_access_permission_granted',
      'remote_access_restriction_enabled',
      'remote_otp_issued',
      'remote_otp_failed',
      'remote_otp_verified',
      'remote_otp_resent',
      'remote_session_expired',
      'remote_access_artifacts_revoked_for_deactivation',
      'user_deactivated',
      'user_reactivated',
    ]) {
      assert.ok(
        events.includes(expectedEvent),
        `missing audit event ${expectedEvent}: ${JSON.stringify(events)}`,
      )
    }
    const grantAudit = audit.body.items.find(
      (item) => item.event === 'remote_access_permission_granted',
    )
    assert.equal(grantAudit.actor, userId)
    assert.equal(grantAudit.targetUser, userId)
    const auditDetails = audit.body.items.map((item) => item.details).join('\n')
    for (const forbidden of [password, deniedPassword, email, code, oldResendCode, lockedCode]) {
      assert.equal(auditDetails.includes(forbidden), false, 'audit details contain a secret or PII')
    }

    console.log('remote access PocketBase 0.36.3 authentication contract passed')
  } finally {
    await stopServer(server)
    await new Promise((resolve) => mailServer.close(resolve))
    fs.rmSync(workspace, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  fs.rmSync(workspace, { recursive: true, force: true })
  process.exitCode = 1
})
