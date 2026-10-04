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
assert.match(version.stdout, /0\.36\.3\b/, `expected PocketBase 0.36.3, got ${version.stdout.trim()}`)
const TEXT_CONTRACT_FIXTURES = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, 'tests/fixtures/curriculum-feedback-text-contract.json'),
    'utf8',
  ),
)

const workspace = fs.mkdtempSync(
  path.join(process.env.TMPDIR || os.tmpdir(), 'gv-rh-feedback-pb036-'),
)
const dataDirectory = path.join(workspace, 'data')
const migrationsDirectory = path.join(workspace, 'migrations')
const hooksDirectory = path.join(workspace, 'hooks')
const emptyHooksDirectory = path.join(workspace, 'empty-hooks')
for (const directory of [migrationsDirectory, hooksDirectory, emptyHooksDirectory]) {
  fs.mkdirSync(directory, { recursive: true })
}

const actorId = 'rhuser000000001'
const departmentId = 'deptrh000000001'
const email = 'rh-feedback@example.test'
const password = 'test-password-12345'
const hmacSecret = 'scratch-gateway-hmac-secret'

const setupMigration = `migrate(
  function (app) {
    var departments = new Collection({
      type: 'base',
      name: 'departamentos',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
    })
    departments.fields.add(new TextField({ name: 'nome', required: true, max: 80 }))
    app.save(departments)
    var department = new Record(departments)
    department.id = '${departmentId}'
    department.set('nome', 'RH')
    app.save(department)

    var users = app.findCollectionByNameOrId('users')
    users.listRule = null
    users.viewRule = null
    users.createRule = null
    users.updateRule = null
    users.deleteRule = null
    users.manageRule = null
    users.fields.add(new TextField({ name: 'profile', required: true, max: 40 }))
    users.fields.add(new TextField({ name: 'departamento', required: false, max: 160 }))
    users.fields.add(new BoolField({ name: 'disabled', required: false }))
    app.save(users)
    var user = new Record(users)
    user.id = '${actorId}'
    user.set('email', '${email}')
    user.set('password', '${password}')
    user.set('verified', true)
    user.set('profile', 'operator')
    user.set('departamento', '${departmentId}')
    user.set('disabled', false)
    app.save(user)
  },
  function (_) {},
)
`
fs.writeFileSync(path.join(migrationsDirectory, '0062_feedback_runtime_setup.js'), setupMigration)
fs.copyFileSync(
  path.join(ROOT, 'pocketbase', 'migrations', '0063_create_curriculum_feedback.js'),
  path.join(migrationsDirectory, '0063_create_curriculum_feedback.js'),
)
const hookSource = fs
  .readFileSync(path.join(ROOT, 'pocketbase', 'hooks', 'curriculum_feedback_commit.js'), 'utf8')
  .replace("$secrets.get('PMAIS_IRIS_GV_HMAC_SECRET') || ''", JSON.stringify(hmacSecret))
fs.writeFileSync(path.join(hooksDirectory, 'curriculum_feedback_commit.pb.js'), hookSource)

function migrate() {
  const result = spawnSync(
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
  const output = `${result.stdout || ''}${result.stderr || ''}`
  assert.equal(result.status, 0, `PocketBase migration failed\n${output}`)
  assert.doesNotMatch(output, /failed to apply migration/i)
}

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
            ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }
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
          resolve({ status: res.statusCode, body: parsed, raw })
        })
      },
    )
    req.once('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

async function waitForReady(baseUrl, processState) {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    if (processState.exitCode !== null) {
      throw new Error(`PocketBase exited before readiness\n${processState.output()}`)
    }
    try {
      const health = await request(`${baseUrl}/api/health`)
      if (health.status === 200) return
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`PocketBase did not become ready\n${processState.output()}`)
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

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    )
  }
  return value
}

const canonicalJson = (value) => JSON.stringify(canonicalize(value))
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')
const hs256 = (value) => crypto.createHmac('sha256', hmacSecret).update(value).digest('hex')

const expectedGatewayCallbackKeys = [
  'schema_version',
  'operation',
  'vacancy_id',
  'wordpress_job_id',
  'application_id',
  'analysis_id',
  'analysis_version',
  'analysis_agent',
  'criteria_version',
  'source_fingerprint',
  'perception',
  'understanding',
  'justification',
  'confirmation',
  'complement',
  'actor_id',
  'interpretation_model',
  'interpretation_request_id',
  'proof_expires_at',
  'proof_signature',
  'calibration_state',
  'idempotency_key',
].sort()

function buildGatewayCallbackBody(overrides = {}) {
  const immutable = {
    schema_version: 'pmais_curriculum_feedback_commit_v1',
    operation: 'commit_curriculum_feedback',
    vacancy_id: 'vacancy-001',
    wordpress_job_id: '75950',
    application_id: '9234',
    analysis_id: 'analysis:v1.001',
    analysis_version: 'curriculum-analysis-v1',
    analysis_agent: 'iris',
    interpretation_request_id: 'irisfeedback-vacancy-001-1791120000-a1b2c3d4',
    interpretation_model: 'gpt-5.5',
    criteria_version: 'criteria-2026-10',
    source_fingerprint: 'a'.repeat(64),
    perception: 'A análise deixou de considerar uma experiência relevante.',
    understanding: 'O RH percebeu evidência profissional subvalorizada.',
    justification: 'A experiência descrita atende ao requisito objetivo da vaga.',
    confirmation: 'confirmed',
    complement: '',
    actor_id: actorId,
    proof_expires_at: Math.floor(Date.now() / 1000) + 600,
    proof_signature: 'b'.repeat(64),
    calibration_state: 'pending_review',
    ...overrides,
  }
  const payload = { ...immutable, idempotency_key: sha256(canonicalJson(immutable)) }
  assert.deepEqual(Object.keys(payload).sort(), expectedGatewayCallbackKeys)
  assert.equal(Object.hasOwn(payload, 'write_policy'), false)
  return payload
}

function materializeTextFixtureValue(definition) {
  if (Object.hasOwn(definition, 'json_escape')) return JSON.parse(`"${definition.json_escape}"`)
  if (Object.hasOwn(definition, 'literal')) return definition.literal
  return `${definition.prefix || ''}${String(definition.token || '').repeat(definition.repeat || 0)}${definition.suffix || ''}`
}

function signedGatewayHeaders(token, payload) {
  const timestamp = String(Math.floor(Date.now() / 1000))
  return {
    Authorization: `Bearer ${token}`,
    'X-PMais-Timestamp': timestamp,
    'X-PMais-Signature': hs256(`${timestamp}.${canonicalJson(payload)}`),
  }
}

async function waitUntilExpired(expiresAt) {
  const deadline = Date.now() + 5_000
  while (Math.floor(Date.now() / 1000) < expiresAt) {
    assert(Date.now() < deadline, `proof did not expire by ${expiresAt}`)
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

async function main() {
  migrate()
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
  const processState = {
    get exitCode() {
      return server.exitCode
    },
    output: () => `${stdout}${stderr}`,
  }

  try {
    await waitForReady(baseUrl, processState)
    const auth = await request(
      `${baseUrl}/api/collections/users/auth-with-password`,
      { method: 'POST' },
      { identity: email, password },
    )
    assert.equal(auth.status, 200, `canonical user authentication failed: ${auth.raw}`)
    assert.equal(auth.body.record.id, actorId)

    const url = `${baseUrl}/backend/v1/curriculum-feedback/commit`
    for (let index = 0; index < TEXT_CONTRACT_FIXTURES.length; index += 1) {
      const fixture = TEXT_CONTRACT_FIXTURES[index]
      const exactValue = materializeTextFixtureValue(fixture.value)
      if (fixture.value.json_escape && !fixture.valid) {
        assert.ok(
          JSON.stringify(exactValue).includes(fixture.value.json_escape),
          `${fixture.name}: exact JSON escape was not preserved by the HTTP client serializer`,
        )
      }
      const overrides = {
        analysis_id: `analysis:text-fixture-${index}`,
        interpretation_request_id: `irisfeedback-text-fixture-${index}`,
        proof_expires_at: Math.floor(Date.now() / 1000) + 600,
        [fixture.field]: exactValue,
      }
      if (fixture.confirmation) overrides.confirmation = fixture.confirmation
      const fixturePayload = buildGatewayCallbackBody(overrides)
      const fixtureResponse = await request(
        url,
        { method: 'POST', headers: signedGatewayHeaders(auth.body.token, fixturePayload) },
        fixturePayload,
      )
      if (fixture.valid) {
        assert.equal(
          fixtureResponse.status,
          200,
          `${fixture.name}: ${fixtureResponse.status} ${fixtureResponse.raw}\n${processState.output()}`,
        )
        assert.equal(fixtureResponse.body.record[fixture.field], exactValue, `${fixture.name}: text changed`)
      } else if (fixture.value.json_escape && fixtureResponse.status === 401) {
        assert.equal(
          fixtureResponse.body.code,
          'CURRICULUM_FEEDBACK_SIGNATURE_INVALID',
          `${fixture.name}: PocketBase transport normalization must fail closed`,
        )
      } else {
        assert.equal(fixtureResponse.status, 422, fixture.name)
        assert.equal(fixtureResponse.body.code, fixture.expected_code, fixture.name)
      }
    }

    const proofExpiresAt = Math.floor(Date.now() / 1000) + 2
    const payload = buildGatewayCallbackBody({ proof_expires_at: proofExpiresAt })
    const first = await request(
      url,
      { method: 'POST', headers: signedGatewayHeaders(auth.body.token, payload) },
      payload,
    )
    assert.equal(
      first.status,
      200,
      `real callback did not persist through helper resolution: ${first.status} ${first.raw}\n${processState.output()}`,
    )
    assert.equal(first.body.ok, true)
    assert.equal(first.body.verified, true)
    assert.equal(first.body.duplicate, false)
    assert.deepEqual(first.body.record, payload)

    await waitUntilExpired(proofExpiresAt)
    const expiredExactReplay = await request(
      url,
      { method: 'POST', headers: signedGatewayHeaders(auth.body.token, payload) },
      payload,
    )
    assert.equal(expiredExactReplay.status, 200, expiredExactReplay.raw)
    assert.equal(expiredExactReplay.body.duplicate, true)
    assert.equal(expiredExactReplay.body.feedback_id, first.body.feedback_id)
    assert.deepEqual(expiredExactReplay.body.record, payload)

    const expiredMissing = buildGatewayCallbackBody({
      analysis_id: 'analysis:v1.expired-missing',
      interpretation_request_id: 'irisfeedback-vacancy-001-expired-missing',
      proof_expires_at: proofExpiresAt,
      proof_signature: 'c'.repeat(64),
    })
    const expiredMissingResponse = await request(
      url,
      { method: 'POST', headers: signedGatewayHeaders(auth.body.token, expiredMissing) },
      expiredMissing,
    )
    assert.equal(expiredMissingResponse.status, 422, expiredMissingResponse.raw)
    assert.deepEqual(expiredMissingResponse.body, {
      ok: false,
      code: 'CURRICULUM_FEEDBACK_PROOF_EXPIRED',
    })

    const finalReplay = await request(
      url,
      { method: 'POST', headers: signedGatewayHeaders(auth.body.token, payload) },
      payload,
    )
    assert.equal(finalReplay.status, 200, finalReplay.raw)
    assert.equal(finalReplay.body.duplicate, true)
    assert.equal(finalReplay.body.feedback_id, first.body.feedback_id)
    console.log(
      'PASS PocketBase 0.36.3 exact Gateway callback body without write_policy: fresh create, expired exact replay, expired missing rejection',
    )
    console.log(
      `PASS PocketBase 0.36.3 ${TEXT_CONTRACT_FIXTURES.length} shared UTF-16/trimmed text fixtures with exact readback`,
    )
  } finally {
    await stopServer(server)
  }
}

main()
  .catch((error) => {
    console.error(error && error.stack ? error.stack : error)
    process.exitCode = 1
  })
  .finally(() => {
    fs.rmSync(workspace, { recursive: true, force: true })
  })
