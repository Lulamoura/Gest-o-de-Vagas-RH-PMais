'use strict'

const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

class MockRecord {
  constructor(collection, data = {}) {
    this.collectionName = typeof collection === 'string' ? collection : collection?.name || ''
    this.data = { ...data }
    this.id = String(data.id || '')
  }
  getString(name) { return this.data[name] == null ? '' : String(this.data[name]) }
  getInt(name) { return Number(this.data[name] || 0) }
  getBool(name) { return this.data[name] === true }
  get(name) { return this.data[name] }
  set(name, value) { this.data[name] = value }
}

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex')
const hs256 = (value, secret) => crypto.createHmac('sha256', String(secret)).update(String(value)).digest('hex')
const routes = []
const history = []
const user = new MockRecord('users', {
  id: 'user-superadmin-001',
  profile: 'superadmin',
  verified: true,
  disabled: false,
  name: 'Pessoa solicitante',
})
const department = new MockRecord('departamentos', { id: 'dept-rh-001', nome: 'RH' })
const relations = {
  'cargo-001': new MockRecord('cargos', { id: 'cargo-001', nome: 'Auxiliar administrativo' }),
  'cliente-001': new MockRecord('clientes', { id: 'cliente-001', nome: 'Cliente teste' }),
  'cidade-001': new MockRecord('cidades', { id: 'cidade-001', nome: 'Recife' }),
  'tipo-vaga-001': new MockRecord('tipos_vaga', { id: 'tipo-vaga-001', nome: 'Efetiva' }),
  'tipo-contrato-001': new MockRecord('tipos_contrato', { id: 'tipo-contrato-001', nome: 'CLT' }),
  'dept-rh-001': department,
  'user-superadmin-001': user,
}
const requisition = new MockRecord('requisitions', {
  id: 'requisition-001',
  updated: '2026-10-03 15:00:00.000Z',
  status: 'Aprovada',
  numero_oe: 'OE-001',
  quantidade_vagas: 1,
  prioridade: 'Alta',
  prazo_desejado: '2026-10-15 00:00:00.000Z',
  faixa_salarial: '',
  jornada: '44 horas',
  horario: '08h às 17h',
  escala: 'Segunda a sexta',
  remuneracao: '',
  beneficios: 'Vale-transporte',
  requisitos: 'Ensino médio completo',
  escolaridade: 'Ensino médio completo',
  experiencia: 'Rotinas administrativas',
  especificacoes: 'Organizar documentos',
  justificativa: 'Substituição',
  observacoes_internas: 'Conferir experiência profissional',
  cargo: 'cargo-001',
  cliente: 'cliente-001',
  cidade: 'cidade-001',
  tipo_vaga: 'tipo-vaga-001',
  tipo_contrato: 'tipo-contrato-001',
  departamento: 'dept-rh-001',
  solicitante: 'user-superadmin-001',
})
const secrets = {
  PMAIS_WORDPRESS_DRAFT_ENABLED: 'true',
  PMAIS_IRIS_GV_HMAC_SECRET: 'gateway-secret',
  PMAIS_IRIS_GV_PROOF_SECRET: 'proof-secret',
}
const app = {
  findRecordById(collection, id) {
    if (collection === 'users' && id === user.id) return user
    if (collection === 'requisitions' && id === requisition.id) return requisition
    const record = relations[id]
    if (record) return record
    throw new Error('not found')
  },
  findRecordsByFilter() { return history },
  findCollectionByNameOrId(name) { return { name } },
  save(record) {
    if (record.collectionName === 'requisition_history') {
      record.id = `history-${history.length + 1}`
      history.push(record)
    }
  },
  runInTransaction(callback) {
    callback({
      findRecordById: this.findRecordById.bind(this),
      findCollectionByNameOrId: this.findCollectionByNameOrId.bind(this),
      save: this.save.bind(this),
    })
  },
  logger() { return { error() {} } },
}
const context = {
  console,
  TextDecoder,
  Record: MockRecord,
  routerAdd(method, route, handler) { routes.push({ method, route, handler }) },
  $apis: { requireAuth: () => ({}) },
  $secrets: { get: (name) => secrets[name] || '' },
  $security: { sha256, hs256 },
  $app: app,
}
vm.createContext(context)
const source = fs.readFileSync(
  path.join(__dirname, '..', 'pocketbase/hooks/requisition_wordpress_draft.js'),
  'utf8',
)
vm.runInContext(source, context, { filename: 'requisition_wordpress_draft.js' })

const commit = routes.find((route) => route.route.endsWith('/wordpress-draft-commit'))
assert.ok(commit, 'atomic commit route missing')
const now = Math.floor(Date.now() / 1000)
const sourceFingerprint = context.sourceFingerprint(context.buildSourceSnapshot(requisition))
const reviewed = {
  titulo_publico: 'Auxiliar administrativo',
  descricao_publica: '<h2>Sobre a vaga</h2><p>Descrição pública revisada.</p>',
  perfil_interno_triagem: 'Validar experiência profissional em rotinas administrativas.',
}
const reviewedHashes = {
  titulo_sha256: sha256(reviewed.titulo_publico),
  descricao_publica_sha256: sha256(reviewed.descricao_publica),
  perfil_interno_sha256: sha256(reviewed.perfil_interno_triagem),
}
const proof = {
  request_id: 'irisgv-requisition-001-test',
  second_brain_version: 'iris-release-001',
  second_brain_sha256: 'a'.repeat(64),
  source_fingerprint: sourceFingerprint,
  expires_at: now + 600,
  signature: '',
}
proof.signature = hs256(
  [
    requisition.id,
    user.id,
    proof.request_id,
    proof.second_brain_version,
    proof.second_brain_sha256,
    proof.source_fingerprint,
    String(proof.expires_at),
  ].join('\n'),
  secrets.PMAIS_IRIS_GV_PROOF_SECRET,
)
const wordpressResult = {
  ok: true,
  duplicate: true,
  verified: true,
  post_status: 'draft',
  wordpress_job_id: '75950',
  wordpress_admin_url: 'https://pmaisservicos.com.br/wp-admin/post.php?post=75950&action=edit',
  verification_hashes: reviewedHashes,
}
const body = {
  schema_version: 'pmais_gv_wordpress_commit_v1',
  operation: 'commit_wordpress_draft',
  requisition_id: requisition.id,
  actor_id: user.id,
  proof,
  reviewed_fields: reviewed,
  reviewed_field_hashes: reviewedHashes,
  wordpress_sync_date: '2026-10-03',
  wordpress_http_status: 200,
  wordpress_result: wordpressResult,
}
const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]))
  }
  return value
}
const canonicalJson = (value) => JSON.stringify(canonicalize(value))
const parsedBody = {
  wordpress_result: {
    verification_hashes: wordpressResult.verification_hashes,
    wordpress_admin_url: wordpressResult.wordpress_admin_url,
    wordpress_job_id: wordpressResult.wordpress_job_id,
    post_status: wordpressResult.post_status,
    verified: wordpressResult.verified,
    duplicate: wordpressResult.duplicate,
    ok: wordpressResult.ok,
  },
  wordpress_http_status: body.wordpress_http_status,
  wordpress_sync_date: body.wordpress_sync_date,
  reviewed_field_hashes: body.reviewed_field_hashes,
  reviewed_fields: body.reviewed_fields,
  proof: body.proof,
  actor_id: body.actor_id,
  requisition_id: body.requisition_id,
  operation: body.operation,
  schema_version: body.schema_version,
}
assert.equal(context.canonicalCommitJson(parsedBody), canonicalJson(body))
const timestamp = String(now)
const signature = hs256(`${timestamp}.${canonicalJson(body)}`, secrets.PMAIS_IRIS_GV_HMAC_SECRET)
const event = {
  auth: { id: user.id, collectionName: 'users' },
  request: {
    pathValue: () => requisition.id,
    header: { get: (name) => ({ 'X-PMais-Timestamp': timestamp, 'X-PMais-Signature': signature }[name] || '') },
  },
  requestInfo: () => ({ body: parsedBody }),
  json: (status, responseBody) => ({ status, body: responseBody }),
  forbiddenError(message) { return { status: 403, body: { message } } },
}

const first = commit.handler(event)
assert.equal(first.status, 200)
assert.equal(first.body.ok, true)
assert.equal(first.body.committed, true)
assert.equal(first.body.duplicate_local, false)
assert.equal(first.body.verified, true)
assert.equal(first.body.post_status, 'draft')
assert.equal(requisition.getString('status'), 'Rascunho criado no WordPress')
assert.equal(requisition.getString('wordpress_job_id'), '75950')
assert.equal(requisition.getString('wordpress_sync_date'), '2026-10-03')
assert.equal(history.length, 1)

const replay = commit.handler(event)
assert.equal(replay.status, 200)
assert.equal(replay.body.duplicate_local, true)
assert.equal(history.length, 1)

console.log('PASS atomic signed commit plus exact idempotent replay')
