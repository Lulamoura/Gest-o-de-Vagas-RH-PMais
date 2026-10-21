'use strict'

const assert = require('node:assert/strict')
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
  set(name, value) { this.data[name] = value }
}

const routes = []
const saved = []
let closeOpenOnTransaction = false
const vacancies = {
  'vac-open': new MockRecord('vacancies', {
    id: 'vac-open',
    wordpress_job_id: '74074',
    status_vaga: 'Aberta',
    ordem_execucao: '28 Seq 2',
    cargo: 'cargo-log',
    cliente: 'cliente-grifos',
    tipo_vaga: 'tipo-vaga',
    tipo_contrato: 'tipo-contrato',
  }),
  'vac-closed': new MockRecord('vacancies', {
    id: 'vac-closed',
    wordpress_job_id: '71268',
    status_vaga: 'Concluída',
    ordem_execucao: '000',
    cargo: 'cargo-log',
    cliente: 'cliente-grifos',
    tipo_vaga: 'tipo-vaga',
    tipo_contrato: 'tipo-contrato',
  }),
  'vac-cancelled': new MockRecord('vacancies', {
    id: 'vac-cancelled',
    wordpress_job_id: '79999',
    status_vaga: 'Cancelada',
    ordem_execucao: '29 Seq 1',
    cargo: 'cargo-log',
    cliente: 'cliente-grifos',
  }),
}
const relations = {
  'cargo-log': new MockRecord('cargos', { id: 'cargo-log', nome: 'Assistente Logístico' }),
  'cliente-grifos': new MockRecord('clientes', { id: 'cliente-grifos', nome: 'Grifos Service' }),
}

const app = {
  findCollectionByNameOrId(name) { return { name } },
  findRecordById(collection, id) {
    if (collection === 'vacancies' && vacancies[id]) return vacancies[id]
    if ((collection === 'cargos' || collection === 'clientes') && relations[id]) return relations[id]
    throw new Error('not found')
  },
  findFirstRecordByFilter(collection, filter, ...params) {
    if (collection === 'vacancies' && filter.includes('wordpress_job_id')) {
      const found = Object.values(vacancies).find((item) => item.getString('wordpress_job_id') === String(params[0]))
      if (found) return found
    }
    throw new Error('not found')
  },
  findRecordsByFilter(collection, filter, _sort, _limit, _offset, params) {
    if (collection !== 'candidates') throw new Error('unexpected collection')
    return saved.filter((item) => {
      if (item.collectionName !== 'candidates') return false
      if (filter.includes('wordpress_candidatura_id')) {
        return item.getString('wordpress_candidatura_id') === String(params.cid)
      }
      return item.getString('email') === String(params.email) &&
        item.getString('cpf') === String(params.cpf) &&
        item.getString('vacancy_id') === String(params.vid)
    }).slice(0, 1)
  },
  save(record) {
    if (!record.id) record.id = `${record.collectionName}-${saved.length + 1}`
    saved.push(record)
  },
  runInTransaction(callback) {
    if (closeOpenOnTransaction) {
      vacancies['vac-open'].set('status_vaga', 'Concluída')
      closeOpenOnTransaction = false
    }
    return callback(this)
  },
  logger() { return { error() {} } },
}

const context = {
  console,
  Record: MockRecord,
  routerAdd(method, route, handler) { routes.push({ method, route, handler }) },
  $secrets: { get: (name) => {
    if (name === 'WORDPRESS_INTEGRATION_TOKEN') return 'integration-token'
    if (name === 'WORDPRESS_CLOSED_VACANCY_OVERRIDE_TOKEN') return 'override-token'
    if (name === 'WORDPRESS_CLOSED_VACANCY_OVERRIDE_ACTOR_ID') return '4'
    if (name === 'WORDPRESS_CLOSED_VACANCY_OVERRIDE_ACTOR_LOGIN') return 'rh-admin'
    return ''
  } },
  $app: app,
}
vm.createContext(context)
const source = fs.readFileSync(
  path.join(__dirname, '..', 'pocketbase/hooks/wordpress_candidate_import.js'),
  'utf8',
)
vm.runInContext(source, context, { filename: 'wordpress_candidate_import.js' })
const route = routes.find((item) => item.method === 'POST' && item.route === '/backend/v1/candidatos/wordpress')
assert.ok(route, 'candidate import route missing')

function request(body, overrideToken = '') {
  return route.handler({
    request: { header: { get: (name) => {
      if (name === 'Authorization') return 'Bearer integration-token'
      if (name === 'X-PMais-Override-Token') return overrideToken
      return ''
    } } },
    requestInfo: () => ({ body }),
    json: (status, responseBody) => ({ status, body: responseBody }),
  })
}

const openPreflight = request({ preflight: true, skip_vaga_id: 'vac-open' })
assert.equal(openPreflight.status, 200)
assert.deepEqual(JSON.parse(JSON.stringify(openPreflight.body)), {
  ok: true,
  preflight: true,
  vacancy: {
    id: 'vac-open',
    cliente: 'Grifos Service',
    cargo: 'Assistente Logístico',
    ordem_execucao: '28 Seq 2',
    status_vaga: 'Aberta',
    requires_confirmation: false,
  },
})
assert.equal(saved.filter((item) => item.collectionName === 'candidates').length, 0)

const closedPreflight = request({ preflight: true, wordpress_vaga_id: '71268' })
assert.equal(closedPreflight.status, 200)
assert.equal(closedPreflight.body.vacancy.status_vaga, 'Concluída')
assert.equal(closedPreflight.body.vacancy.requires_confirmation, true)

const cancelledPreflight = request({ preflight: true, skip_vaga_id: 'vac-cancelled' })
assert.equal(cancelledPreflight.status, 200)
assert.equal(cancelledPreflight.body.vacancy.status_vaga, 'Cancelada')
assert.equal(cancelledPreflight.body.vacancy.requires_confirmation, true)

const conflictingDestination = request({
  preflight: true,
  skip_vaga_id: 'vac-open',
  wordpress_vaga_id: '71268',
})
assert.equal(conflictingDestination.status, 409)
assert.equal(conflictingDestination.body.code, 'pmais_gv_vacancy_conflict')

const missingStableId = request({ preflight: true, skip_vaga_id: 'vac-missing' })
assert.equal(missingStableId.status, 404)
assert.equal(missingStableId.body.ok, false)

const baseCandidate = {
  wordpress_candidatura_id: '73912',
  nome: 'Pessoa teste',
  email: 'candidate@example.invalid',
  telefone: '00000000000',
  cpf: '00000000000',
  skip_vaga_id: 'vac-closed',
}
const blocked = request(baseCandidate)
assert.equal(blocked.status, 409)
assert.equal(blocked.body.code, 'pmais_gv_vacancy_closed')
assert.equal(blocked.body.vacancy.id, 'vac-closed')
assert.equal(blocked.body.vacancy.status_vaga, 'Concluída')
assert.equal(saved.filter((item) => item.collectionName === 'candidates').length, 0)

const missingOverrideAudit = request({ ...baseCandidate, confirm_closed_vacancy: true })
assert.equal(missingOverrideAudit.status, 400)
assert.equal(missingOverrideAudit.body.code, 'pmais_gv_closed_vacancy_override_invalid')
assert.equal(saved.filter((item) => item.collectionName === 'candidates').length, 0)

const forgedOverride = request({
  ...baseCandidate,
  confirm_closed_vacancy: true,
  closed_vacancy_override_reason: 'Envio excepcional autorizado após revisão do destino.',
  override_actor_id: '4',
  override_actor_login: 'rh-admin',
})
assert.equal(forgedOverride.status, 403)
assert.equal(forgedOverride.body.code, 'pmais_gv_closed_vacancy_override_unauthorized')
assert.equal(saved.filter((item) => item.collectionName === 'candidates').length, 0)

const impersonatedActor = request({
  ...baseCandidate,
  confirm_closed_vacancy: true,
  closed_vacancy_override_reason: 'Envio excepcional autorizado após revisão do destino.',
  override_actor_id: '99',
  override_actor_login: 'outro-admin',
}, 'override-token')
assert.equal(impersonatedActor.status, 403)
assert.equal(impersonatedActor.body.code, 'pmais_gv_closed_vacancy_override_actor_invalid')
assert.equal(saved.filter((item) => item.collectionName === 'candidates').length, 0)

const confirmed = request({
  ...baseCandidate,
  confirm_closed_vacancy: true,
  closed_vacancy_override_reason: 'Envio excepcional autorizado após revisão do destino.',
  override_actor_id: '4',
  override_actor_login: 'rh-admin',
}, 'override-token')
assert.equal(confirmed.status, 201)
assert.equal(confirmed.body.ok, true)
assert.equal(confirmed.body.closed_vacancy_override, true)
const created = saved.find((item) => item.collectionName === 'candidates')
assert.ok(created)
assert.equal(created.getString('vacancy_id'), 'vac-closed')
assert.equal(created.getString('ordem_execucao'), '000')
const overrideLog = saved
  .filter((item) => item.collectionName === 'wordpress_import_logs')
  .find((item) => item.getString('mensagem').includes('rh-admin'))
assert.ok(overrideLog, 'closed-vacancy override audit log missing actor')
assert.match(overrideLog.getString('mensagem'), /Envio excepcional autorizado/)

const openCreated = request({
  ...baseCandidate,
  wordpress_candidatura_id: '73913',
  skip_vaga_id: 'vac-open',
})
assert.equal(openCreated.status, 201)
assert.equal(openCreated.body.closed_vacancy_override, false)

closeOpenOnTransaction = true
const racedClosed = request({
  ...baseCandidate,
  wordpress_candidatura_id: '73914',
  email: 'race@example.invalid',
  cpf: '11111111111',
  skip_vaga_id: 'vac-open',
})
assert.equal(racedClosed.status, 409)
assert.equal(racedClosed.body.code, 'pmais_gv_vacancy_closed')
assert.equal(saved.filter((item) => item.collectionName === 'candidates').length, 2)
assert.ok(
  saved
    .filter((item) => item.collectionName === 'wordpress_import_logs')
    .every((item) => ['sucesso', 'duplicada', 'erro'].includes(item.getString('status'))),
  'import logs must use only schema-supported status values',
)

console.log('wordpress candidate closed-vacancy contracts passed')
