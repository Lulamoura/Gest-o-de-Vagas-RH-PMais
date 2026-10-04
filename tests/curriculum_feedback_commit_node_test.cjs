'use strict'

const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const ROOT = path.join(__dirname, '..')
const MIGRATION_PATH = path.join(
  ROOT,
  'pocketbase/migrations/0063_create_curriculum_feedback.js',
)
const HOOK_PATH = path.join(ROOT, 'pocketbase/hooks/curriculum_feedback_commit.js')
const TEXT_CONTRACT_FIXTURES = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, 'tests/fixtures/curriculum-feedback-text-contract.json'),
    'utf8',
  ),
)

const canonicalize = (value) => {
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
const plain = (value) => JSON.parse(JSON.stringify(value))
const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex')
const hs256 = (value, secret) =>
  crypto.createHmac('sha256', String(secret)).update(String(value)).digest('hex')

function loadMigration() {
  let up = null
  let down = null
  const saved = []
  class MockCollection {
    constructor(definition) {
      Object.assign(this, definition)
    }
  }
  const context = {
    Collection: MockCollection,
    migrate(upFn, downFn) {
      up = upFn
      down = downFn
    },
  }
  vm.createContext(context)
  vm.runInContext(fs.readFileSync(MIGRATION_PATH, 'utf8'), context, {
    filename: path.basename(MIGRATION_PATH),
  })
  assert.equal(typeof up, 'function', 'migration up callback missing')
  assert.equal(typeof down, 'function', 'migration down callback missing')
  const app = {
    save(collection) {
      saved.push(collection)
    },
    findCollectionByNameOrId(name) {
      const collection = saved.find((item) => item.name === name)
      if (!collection) throw new Error(`collection not found: ${name}`)
      return collection
    },
    delete(collection) {
      const index = saved.indexOf(collection)
      if (index >= 0) saved.splice(index, 1)
    },
  }
  up(app)
  return { collection: saved.find((item) => item.name === 'curriculum_feedback'), down, app }
}

function assertPrivateMigration() {
  const { collection } = loadMigration()
  assert.ok(collection, 'curriculum_feedback collection missing')
  assert.equal(collection.type, 'base')
  for (const rule of ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule']) {
    assert.equal(collection[rule], null, `${rule} must be closed`)
  }
  assert.ok(
    collection.indexes.some((index) =>
      /CREATE UNIQUE INDEX .*curriculum_feedback.*\(idempotency_key\)/i.test(index),
    ),
    'idempotency_key must have a unique index',
  )
  const fields = Object.fromEntries(collection.fields.map((field) => [field.name, field]))
  const expectedFields = [
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
    'created',
  ]
  assert.deepEqual(Object.keys(fields).sort(), expectedFields.sort())
  for (const name of expectedFields.filter((name) => !['created', 'complement'].includes(name))) {
    assert.equal(fields[name].required, true, `${name} must be required`)
  }
  assert.notEqual(fields.complement.required, true, 'empty complement is valid for confirmed feedback')
  for (const name of ['perception', 'understanding', 'justification']) {
    assert.equal(
      fields[name].max || 0,
      0,
      `${name} storage must not reject exact padded text after semantic validation`,
    )
  }
  assert.equal(fields.complement.max, 4000, 'complement storage keeps the raw maximum')
  for (const forbidden of [
    'curriculum',
    'resume',
    'candidate_name',
    'email',
    'phone',
    'cpf',
    'address',
    'rating',
    'status',
  ]) {
    assert.equal(fields[forbidden], undefined, `forbidden PII/mutation field: ${forbidden}`)
  }
}

class MockRecord {
  constructor(collection, data = {}) {
    this.collectionName = typeof collection === 'string' ? collection : collection?.name || ''
    this.data = { ...data }
    this.id = String(data.id || '')
  }
  get(name) {
    return this.data[name]
  }
  getString(name) {
    return this.data[name] == null ? '' : String(this.data[name])
  }
  getInt(name) {
    return Number(this.data[name] || 0)
  }
  getBool(name) {
    return this.data[name] === true
  }
  set(name, value) {
    this.data[name] = value
  }
}

function createHarness() {
  let nowMilliseconds = Date.now()
  const routes = []
  const feedbackRecords = []
  const saves = []
  const sideEffects = { http: 0, vacancyWrites: 0, candidateWrites: 0, wordpressWrites: 0 }
  const users = {
    'admin-user-001': new MockRecord('users', {
      id: 'admin-user-001',
      profile: 'admin',
      verified: true,
      disabled: false,
    }),
    'super-user-001': new MockRecord('users', {
      id: 'super-user-001',
      profile: 'superadmin',
      verified: true,
      disabled: false,
    }),
    'rh-user-001': new MockRecord('users', {
      id: 'rh-user-001',
      profile: 'operator',
      departamento: 'dept-rh-001',
      verified: true,
      disabled: false,
    }),
    'sales-user-001': new MockRecord('users', {
      id: 'sales-user-001',
      profile: 'operator',
      departamento: 'dept-sales-001',
      verified: true,
      disabled: false,
    }),
    'viewer-rh-001': new MockRecord('users', {
      id: 'viewer-rh-001',
      profile: 'viewer',
      departamento: 'dept-rh-001',
      verified: true,
      disabled: false,
    }),
    'inactive-user-001': new MockRecord('users', {
      id: 'inactive-user-001',
      profile: 'admin',
      verified: false,
      disabled: false,
    }),
    'disabled-rh-001': new MockRecord('users', {
      id: 'disabled-rh-001',
      profile: 'operator',
      departamento: 'dept-rh-001',
      verified: true,
      disabled: true,
    }),
  }
  const departments = {
    'dept-rh-001': new MockRecord('departamentos', { id: 'dept-rh-001', nome: 'RH' }),
    'dept-sales-001': new MockRecord('departamentos', {
      id: 'dept-sales-001',
      nome: 'Comercial',
    }),
  }
  let failFeedbackReadbackOnce = false
  let feedbackSequence = 0
  const app = {
    findCollectionByNameOrId(name) {
      if (name === 'curriculum_feedback') return { name }
      throw new Error(`unknown collection ${name}`)
    },
    findRecordById(collection, id) {
      if (collection === 'users' && users[id]) return users[id]
      if (collection === 'departamentos' && departments[id]) return departments[id]
      if (collection === 'curriculum_feedback') {
        if (failFeedbackReadbackOnce) {
          failFeedbackReadbackOnce = false
          throw new Error('simulated readback loss')
        }
        const found = feedbackRecords.find((record) => record.id === id)
        if (found) return found
      }
      throw new Error(`not found ${collection}/${id}`)
    },
    findFirstRecordByFilter(collection, filter) {
      if (collection !== 'curriculum_feedback') throw new Error('unexpected collection query')
      const match = String(filter).match(/[a-f0-9]{64}/)
      const found = match
        ? feedbackRecords.find((record) => record.getString('idempotency_key') === match[0])
        : null
      if (!found) throw new Error('not found')
      return found
    },
    save(record) {
      saves.push(record.collectionName)
      if (record.collectionName !== 'curriculum_feedback') {
        if (record.collectionName === 'vacancies') sideEffects.vacancyWrites += 1
        if (record.collectionName === 'candidates') sideEffects.candidateWrites += 1
        throw new Error(`unexpected write to ${record.collectionName}`)
      }
      if (
        feedbackRecords.some(
          (item) => item.getString('idempotency_key') === record.getString('idempotency_key'),
        )
      ) {
        throw new Error('UNIQUE constraint failed: curriculum_feedback.idempotency_key')
      }
      feedbackSequence += 1
      record.id = `feedback-${feedbackSequence}`
      feedbackRecords.push(record)
    },
    logger() {
      return { error() {} }
    },
  }
  const secrets = { PMAIS_IRIS_GV_HMAC_SECRET: 'gateway-hmac-secret' }
  const authMiddleware = { kind: 'requireAuth' }
  const context = {
    console,
    Date: { now: () => nowMilliseconds },
    Record: MockRecord,
    $app: app,
    $apis: { requireAuth: () => authMiddleware },
    $secrets: { get: (name) => secrets[name] || '' },
    $security: { sha256, hs256 },
    $http: {
      send() {
        sideEffects.http += 1
        sideEffects.wordpressWrites += 1
        throw new Error('HTTP is forbidden in feedback commit')
      },
    },
    routerAdd(method, route, handler, middleware) {
      routes.push({ method, route, handler, middleware })
    },
  }
  vm.createContext(context)
  vm.runInContext(fs.readFileSync(HOOK_PATH, 'utf8'), context, {
    filename: path.basename(HOOK_PATH),
  })
  const route = routes.find(
    (candidate) =>
      candidate.method === 'POST' && candidate.route === '/backend/v1/curriculum-feedback/commit',
  )
  assert.ok(route, 'curriculum feedback commit route missing')
  assert.equal(route.middleware, authMiddleware, 'route must require bearer authentication')

  return {
    route,
    context,
    feedbackRecords,
    saves,
    sideEffects,
    secrets,
    setFailFeedbackReadbackOnce() {
      failFeedbackReadbackOnce = true
    },
    get nowSeconds() {
      return Math.floor(nowMilliseconds / 1000)
    },
    advanceSeconds(seconds) {
      nowMilliseconds += seconds * 1000
    },
  }
}

function buildPayload(actorId = 'rh-user-001', overrides = {}) {
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
  return { ...immutable, idempotency_key: sha256(canonicalJson(immutable)) }
}

function resignPayload(payload) {
  const { idempotency_key: _ignored, ...immutable } = payload
  return { ...payload, idempotency_key: sha256(canonicalJson(immutable)) }
}

function materializeTextFixtureValue(definition) {
  if (Object.hasOwn(definition, 'json_escape')) return JSON.parse(`"${definition.json_escape}"`)
  if (Object.hasOwn(definition, 'literal')) return definition.literal
  return `${definition.prefix || ''}${String(definition.token || '').repeat(definition.repeat || 0)}${definition.suffix || ''}`
}

function makeEvent(harness, payload, options = {}) {
  const timestamp = String(options.timestamp ?? Math.floor(Date.now() / 1000))
  const signature =
    options.signature ??
    hs256(`${timestamp}.${canonicalJson(payload)}`, harness.secrets.PMAIS_IRIS_GV_HMAC_SECRET)
  const actorId = options.actorId ?? payload.actor_id
  const headers = {
    'X-PMais-Timestamp': timestamp,
    'X-PMais-Signature': signature,
  }
  return {
    auth:
      options.auth === null
        ? null
        : {
            id: actorId,
            profile: options.snapshotProfile || 'viewer',
            collectionName: options.authCollectionName || 'users',
          },
    request: {
      header: { get: (name) => headers[name] || '' },
    },
    requestInfo: () => ({ body: options.body ?? payload }),
    json: (status, body) => ({ status, body }),
    forbiddenError: (message) => ({ status: 403, body: { message } }),
  }
}

function assertNoSideEffects(harness) {
  assert.equal(harness.sideEffects.http, 0)
  assert.equal(harness.sideEffects.wordpressWrites, 0)
  assert.equal(harness.sideEffects.vacancyWrites, 0)
  assert.equal(harness.sideEffects.candidateWrites, 0)
  assert.ok(harness.saves.every((collection) => collection === 'curriculum_feedback'))
}

function runTests() {
  assertPrivateMigration()

  {
    const harness = createHarness()
    const payload = buildPayload()
    const invalidSignature = harness.route.handler(
      makeEvent(harness, payload, { signature: '0'.repeat(64) }),
    )
    assert.equal(invalidSignature.status, 401)
    assert.equal(harness.feedbackRecords.length, 0)

    const stale = harness.route.handler(
      makeEvent(harness, payload, {
        timestamp: Math.floor(Date.now() / 1000) - 301,
      }),
    )
    assert.equal(stale.status, 401)
    assert.equal(harness.feedbackRecords.length, 0)
    assertNoSideEffects(harness)
  }

  for (const actorId of [
    'inactive-user-001',
    'disabled-rh-001',
    'sales-user-001',
    'viewer-rh-001',
  ]) {
    const harness = createHarness()
    const payload = buildPayload(actorId)
    const response = harness.route.handler(makeEvent(harness, payload, { actorId }))
    assert.equal(response.status, 403, `${actorId} must be denied`)
    assert.equal(harness.feedbackRecords.length, 0)
    assertNoSideEffects(harness)
  }

  {
    const harness = createHarness()
    const payload = buildPayload('sales-user-001')
    const spoofed = harness.route.handler(
      makeEvent(harness, payload, { actorId: 'rh-user-001', snapshotProfile: 'superadmin' }),
    )
    assert.equal(spoofed.status, 403)
    assert.equal(harness.feedbackRecords.length, 0)
    assertNoSideEffects(harness)
  }

  {
    const harness = createHarness()
    const payload = buildPayload('rh-user-001')
    const integrationIdentity = harness.route.handler(
      makeEvent(harness, payload, {
        actorId: 'rh-user-001',
        authCollectionName: 'integration_accounts',
        snapshotProfile: 'superadmin',
      }),
    )
    assert.equal(integrationIdentity.status, 403)
    assert.equal(harness.feedbackRecords.length, 0)
    assertNoSideEffects(harness)
  }

  const invalidCases = [
    ['schema', { schema_version: 'pmais_curriculum_feedback_commit_v2' }],
    ['operation', { operation: 'update_curriculum_feedback' }],
    ['vacancy id', { vacancy_id: '../vacancy' }],
    ['WordPress id', { wordpress_job_id: '0' }],
    ['application id', { application_id: 'application-1' }],
    ['analysis id', { analysis_id: 'analysis/id' }],
    ['analysis version size', { analysis_version: 'v'.repeat(81) }],
    ['agent', { analysis_agent: 'generic-agent' }],
    ['interpretation request id', { interpretation_request_id: 'bad/request' }],
    ['interpretation model empty', { interpretation_model: '' }],
    ['criteria size', { criteria_version: 'c'.repeat(161) }],
    ['source hash', { source_fingerprint: 'A'.repeat(64) }],
    ['perception minimum', { perception: 'ab' }],
    ['understanding size', { understanding: 'u'.repeat(4001) }],
    ['justification empty', { justification: '' }],
    ['confirmation', { confirmation: 'cancelled' }],
    ['confirmed complement', { confirmation: 'confirmed', complement: 'texto indevido' }],
    ['complement missing', { confirmation: 'complemented', complement: '' }],
    ['actor id', { actor_id: 'bad/actor' }],
    ['expired proof', { proof_expires_at: Math.floor(Date.now() / 1000) }],
    ['proof hash', { proof_signature: 'not-a-hash' }],
    ['calibration state', { calibration_state: 'accepted' }],
  ]
  for (const [label, mutation] of invalidCases) {
    const harness = createHarness()
    const payload = resignPayload(buildPayload('rh-user-001', mutation))
    const actorId = mutation.actor_id ? 'rh-user-001' : payload.actor_id
    const response = harness.route.handler(makeEvent(harness, payload, { actorId }))
    assert.ok([400, 403, 422].includes(response.status), `${label} unexpectedly returned ${response.status}`)
    assert.equal(harness.feedbackRecords.length, 0, `${label} wrote a record`)
    assertNoSideEffects(harness)
  }

  for (let index = 0; index < TEXT_CONTRACT_FIXTURES.length; index += 1) {
    const fixture = TEXT_CONTRACT_FIXTURES[index]
    const harness = createHarness()
    const exactValue = materializeTextFixtureValue(fixture.value)
    if (fixture.value.json_escape && !fixture.valid) {
      assert.ok(
        JSON.stringify(exactValue).includes(fixture.value.json_escape),
        `${fixture.name}: exact JSON escape was not preserved by the client serializer`,
      )
    }
    const overrides = {
      analysis_id: `analysis:text-fixture-${index}`,
      interpretation_request_id: `irisfeedback-text-fixture-${index}`,
      [fixture.field]: exactValue,
    }
    if (fixture.confirmation) overrides.confirmation = fixture.confirmation
    const payload = resignPayload(buildPayload('rh-user-001', overrides))
    const response = harness.route.handler(
      makeEvent(harness, payload, {
        body: fixture.value.json_escape ? JSON.stringify(payload) : payload,
      }),
    )

    if (fixture.valid) {
      assert.equal(response.status, 200, `${fixture.name}: ${JSON.stringify(response.body)}`)
      assert.equal(response.body.record[fixture.field], exactValue, `${fixture.name}: text changed`)
      assert.equal(harness.feedbackRecords.length, 1, `${fixture.name}: record missing`)
    } else {
      assert.equal(response.status, 422, fixture.name)
      assert.equal(response.body.code, fixture.expected_code, fixture.name)
      assert.equal(harness.feedbackRecords.length, 0, `${fixture.name}: invalid record persisted`)
    }
    assertNoSideEffects(harness)
  }

  {
    const harness = createHarness()
    const payload = buildPayload()
    const badIdempotency = { ...payload, idempotency_key: 'c'.repeat(64) }
    const response = harness.route.handler(makeEvent(harness, badIdempotency))
    assert.equal(response.status, 409)
    assert.equal(harness.feedbackRecords.length, 0)

    const withProfile = { ...payload, actor_profile: 'superadmin' }
    const profileResponse = harness.route.handler(makeEvent(harness, withProfile))
    assert.equal(profileResponse.status, 400)
    assert.equal(harness.feedbackRecords.length, 0)
    assertNoSideEffects(harness)
  }

  {
    const harness = createHarness()
    const payload = buildPayload()
    const reordered = Object.fromEntries(Object.entries(payload).reverse())
    const first = harness.route.handler(makeEvent(harness, payload, { body: reordered }))
    assert.equal(first.status, 200)
    assert.deepEqual(Object.keys(first.body).sort(), [
      'duplicate',
      'feedback_id',
      'ok',
      'record',
      'verified',
    ])
    assert.deepEqual(plain(first.body), {
      ok: true,
      duplicate: false,
      verified: true,
      feedback_id: 'feedback-1',
      record: payload,
    })
    assert.equal(harness.feedbackRecords.length, 1)

    const replay = harness.route.handler(makeEvent(harness, reordered))
    assert.equal(replay.status, 200)
    assert.deepEqual(plain(replay.body), {
      ok: true,
      duplicate: true,
      verified: true,
      feedback_id: 'feedback-1',
      record: payload,
    })
    assert.equal(harness.feedbackRecords.length, 1)
    assertNoSideEffects(harness)
  }

  {
    const harness = createHarness()
    const payload = buildPayload('admin-user-001', {
      analysis_id: 'analysis:lost-response',
    })
    const canonicalPayload = resignPayload(payload)
    harness.setFailFeedbackReadbackOnce()
    const lostResponse = harness.route.handler(
      makeEvent(harness, canonicalPayload, { actorId: 'admin-user-001' }),
    )
    assert.equal(lostResponse.status, 500)
    assert.equal(harness.feedbackRecords.length, 1, 'write must survive lost readback')

    const recovered = harness.route.handler(
      makeEvent(harness, canonicalPayload, { actorId: 'admin-user-001' }),
    )
    assert.equal(recovered.status, 200)
    assert.equal(recovered.body.duplicate, true)
    assert.equal(recovered.body.feedback_id, 'feedback-1')
    assert.deepEqual(plain(recovered.body.record), canonicalPayload)
    assert.equal(harness.feedbackRecords.length, 1)
    assertNoSideEffects(harness)
  }

  {
    const harness = createHarness()
    const payload = resignPayload(
      buildPayload('rh-user-001', {
        analysis_id: 'analysis:expired-replay',
        proof_expires_at: harness.nowSeconds + 1,
      }),
    )
    const first = harness.route.handler(
      makeEvent(harness, payload, { timestamp: harness.nowSeconds }),
    )
    assert.equal(first.status, 200)
    assert.equal(first.body.duplicate, false)
    harness.advanceSeconds(2)

    const exactExpiredReplay = harness.route.handler(
      makeEvent(harness, payload, { timestamp: harness.nowSeconds }),
    )
    assert.equal(exactExpiredReplay.status, 200)
    assert.equal(exactExpiredReplay.body.duplicate, true)
    assert.equal(exactExpiredReplay.body.feedback_id, first.body.feedback_id)
    assert.equal(harness.feedbackRecords.length, 1)

    const expiredNewPayload = resignPayload(
      buildPayload('rh-user-001', {
        analysis_id: 'analysis:expired-new-write',
        proof_expires_at: harness.nowSeconds - 1,
      }),
    )
    const expiredNewWrite = harness.route.handler(
      makeEvent(harness, expiredNewPayload, { timestamp: harness.nowSeconds }),
    )
    assert.equal(expiredNewWrite.status, 422)
    assert.equal(expiredNewWrite.body.code, 'CURRICULUM_FEEDBACK_PROOF_EXPIRED')
    assert.equal(harness.feedbackRecords.length, 1)
    assertNoSideEffects(harness)
  }

  console.log('PASS private immutable curriculum feedback collection contract')
  console.log('PASS signed canonical HMAC, canonical active actor and RH/admin authorization')
  console.log(`PASS ${TEXT_CONTRACT_FIXTURES.length} shared UTF-16/trimmed text fixtures`)
  console.log('PASS exact validation, idempotent replay/readback and zero collateral mutations')
}

runTests()
