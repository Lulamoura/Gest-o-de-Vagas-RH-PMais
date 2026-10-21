'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const net = require('node:net')
const os = require('node:os')
const path = require('node:path')
const { spawn, spawnSync } = require('node:child_process')

const ROOT = path.join(__dirname, '..')
const POCKETBASE = process.env.POCKETBASE_BIN
assert(POCKETBASE, 'POCKETBASE_BIN must point to PocketBase 0.36.3')
const version = spawnSync(POCKETBASE, ['--version'], { encoding: 'utf8' })
assert.equal(version.status, 0, version.stderr)
assert.match(version.stdout, /0\.36\.3\b/)

const workspace = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'gv-candidate-guard-pb036-'))
const dataDirectory = path.join(workspace, 'data')
const migrationsDirectory = path.join(workspace, 'migrations')
const hooksDirectory = path.join(workspace, 'hooks')
const emptyHooksDirectory = path.join(workspace, 'empty-hooks')
for (const directory of [migrationsDirectory, hooksDirectory, emptyHooksDirectory]) {
  fs.mkdirSync(directory, { recursive: true })
}

const setupMigration = `migrate(
  function (app) {
    function base(name) {
      var collection = new Collection({
        type: 'base',
        name: name,
        listRule: '',
        viewRule: '',
        createRule: null,
        updateRule: null,
        deleteRule: null,
      })
      app.save(collection)
      return collection
    }
    function text(collection, name, required, max) {
      collection.fields.add(new TextField({ name: name, required: !!required, max: max || 500 }))
    }

    var clients = base('clientes')
    text(clients, 'nome', true, 120)
    app.save(clients)
    var client = new Record(clients)
    client.id = 'clientgrifos001'
    client.set('nome', 'Grifos Service')
    app.save(client)

    var roles = base('cargos')
    text(roles, 'nome', true, 120)
    app.save(roles)
    var role = new Record(roles)
    role.id = 'roleassistlog01'
    role.set('nome', 'Assistente Logístico')
    app.save(role)

    var vacancies = base('vacancies')
    for (var field of ['wordpress_job_id', 'status_vaga', 'ordem_execucao', 'cargo', 'cliente', 'tipo_vaga', 'tipo_contrato']) {
      text(vacancies, field, false, 160)
    }
    app.save(vacancies)
    var openVacancy = new Record(vacancies)
    openVacancy.id = 'vacancyopen0001'
    openVacancy.set('wordpress_job_id', '74074')
    openVacancy.set('status_vaga', 'Aberta')
    openVacancy.set('ordem_execucao', '28 Seq 2')
    openVacancy.set('cargo', role.id)
    openVacancy.set('cliente', client.id)
    app.save(openVacancy)
    var closedVacancy = new Record(vacancies)
    closedVacancy.id = 'vacancyclosed01'
    closedVacancy.set('wordpress_job_id', '71268')
    closedVacancy.set('status_vaga', 'Concluída')
    closedVacancy.set('ordem_execucao', '000')
    closedVacancy.set('cargo', role.id)
    closedVacancy.set('cliente', client.id)
    app.save(closedVacancy)

    var candidates = base('candidates')
    for (var candidateField of ['vacancy_id', 'nome', 'email', 'telefone', 'cpf', 'bairro', 'cidade', 'wordpress_candidatura_id', 'status_candidato', 'ordem_execucao', 'tipo_vaga', 'tipo_contrato']) {
      text(candidates, candidateField, false, 500)
    }
    candidates.fields.add(new NumberField({ name: 'rank', required: false }))
    app.save(candidates)

    var logs = base('wordpress_import_logs')
    for (var logField of ['wordpress_job_id', 'origem', 'mensagem']) {
      text(logs, logField, false, 2000)
    }
    logs.fields.add(new SelectField({
      name: 'status',
      required: true,
      values: ['sucesso', 'duplicada', 'erro'],
      maxSelect: 1,
    }))
    app.save(logs)
  },
  function (_) {},
)`
fs.writeFileSync(path.join(migrationsDirectory, '0001_setup.js'), setupMigration)
const hookSource = fs
  .readFileSync(path.join(ROOT, 'pocketbase', 'hooks', 'wordpress_candidate_import.js'), 'utf8')
  .replace("$secrets.get('WORDPRESS_INTEGRATION_TOKEN') || ''", JSON.stringify('integration-token'))
  .replace("$secrets.get('WORDPRESS_CLOSED_VACANCY_OVERRIDE_TOKEN') || ''", JSON.stringify('override-token'))
  .replace("$secrets.get('WORDPRESS_CLOSED_VACANCY_OVERRIDE_ACTOR_ID') || ''", JSON.stringify('4'))
  .replace("$secrets.get('WORDPRESS_CLOSED_VACANCY_OVERRIDE_ACTOR_LOGIN') || ''", JSON.stringify('rh-admin'))
fs.writeFileSync(path.join(hooksDirectory, 'wordpress_candidate_import.pb.js'), hookSource)

const migration = spawnSync(
  POCKETBASE,
  ['migrate', 'up', '--dir', dataDirectory, '--migrationsDir', migrationsDirectory, '--hooksDir', emptyHooksDirectory, '--dev=false'],
  { cwd: ROOT, encoding: 'utf8' },
)
assert.equal(migration.status, 0, `${migration.stdout || ''}${migration.stderr || ''}`)

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      server.close((error) => error ? reject(error) : resolve(port))
    })
  })
}

function request(url, options = {}, body) {
  return new Promise((resolve, reject) => {
    const target = new URL(url)
    const payload = body === undefined ? null : JSON.stringify(body)
    const req = http.request(target, {
      method: options.method || 'GET',
      headers: {
        ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}),
        ...(options.headers || {}),
      },
    }, (res) => {
      let raw = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { raw += chunk })
      res.on('end', () => {
        let parsed = null
        try { parsed = raw ? JSON.parse(raw) : null } catch (_) {}
        resolve({ status: res.statusCode, body: parsed, raw })
      })
    })
    req.once('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

async function waitForReady(baseUrl, child, output) {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`PocketBase exited early\n${output.join('')}`)
    try {
      const health = await request(`${baseUrl}/api/health`)
      if (health.status === 200) return
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`PocketBase readiness timeout\n${output.join('')}`)
}

async function main() {
  const port = await reservePort()
  const output = []
  const child = spawn(POCKETBASE, [
    'serve',
    '--http', `127.0.0.1:${port}`,
    '--dir', dataDirectory,
    '--migrationsDir', migrationsDirectory,
    '--hooksDir', hooksDirectory,
    '--dev=false',
  ], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.on('data', (chunk) => output.push(String(chunk)))
  child.stderr.on('data', (chunk) => output.push(String(chunk)))
  const baseUrl = `http://127.0.0.1:${port}`
  const auth = { authorization: 'Bearer integration-token' }
  try {
    await waitForReady(baseUrl, child, output)

    const open = await request(`${baseUrl}/backend/v1/candidatos/wordpress`, { method: 'POST', headers: auth }, {
      preflight: true,
      skip_vaga_id: 'vacancyopen0001',
    })
    assert.equal(open.status, 200, open.raw)
    assert.deepEqual(open.body.vacancy, {
      id: 'vacancyopen0001',
      cliente: 'Grifos Service',
      cargo: 'Assistente Logístico',
      ordem_execucao: '28 Seq 2',
      status_vaga: 'Aberta',
      requires_confirmation: false,
    })

    const candidate = {
      wordpress_candidatura_id: 'runtime-closed-1',
      nome: 'Pessoa teste',
      email: 'runtime@example.invalid',
      telefone: '00000000000',
      cpf: '00000000000',
      skip_vaga_id: 'vacancyclosed01',
    }
    const blocked = await request(`${baseUrl}/backend/v1/candidatos/wordpress`, { method: 'POST', headers: auth }, candidate)
    assert.equal(blocked.status, 409, blocked.raw)
    assert.equal(blocked.body.code, 'pmais_gv_vacancy_closed')

    const incomplete = await request(`${baseUrl}/backend/v1/candidatos/wordpress`, { method: 'POST', headers: auth }, {
      ...candidate,
      confirm_closed_vacancy: true,
    })
    assert.equal(incomplete.status, 400, incomplete.raw)
    assert.equal(incomplete.body.code, 'pmais_gv_closed_vacancy_override_invalid')

    const overridePayload = {
      ...candidate,
      confirm_closed_vacancy: true,
      closed_vacancy_override_reason: 'Homologação explícita do bloqueio administrativo.',
      override_actor_id: '4',
      override_actor_login: 'rh-admin',
    }
    const forged = await request(`${baseUrl}/backend/v1/candidatos/wordpress`, { method: 'POST', headers: auth }, overridePayload)
    assert.equal(forged.status, 403, forged.raw)
    assert.equal(forged.body.code, 'pmais_gv_closed_vacancy_override_unauthorized')

    const impersonated = await request(`${baseUrl}/backend/v1/candidatos/wordpress`, {
      method: 'POST',
      headers: { ...auth, 'x-pmais-override-token': 'override-token' },
    }, { ...overridePayload, override_actor_id: '99', override_actor_login: 'outro-admin' })
    assert.equal(impersonated.status, 403, impersonated.raw)
    assert.equal(impersonated.body.code, 'pmais_gv_closed_vacancy_override_actor_invalid')

    const confirmed = await request(`${baseUrl}/backend/v1/candidatos/wordpress`, {
      method: 'POST',
      headers: { ...auth, 'x-pmais-override-token': 'override-token' },
    }, overridePayload)
    assert.equal(confirmed.status, 201, confirmed.raw)
    assert.equal(confirmed.body.closed_vacancy_override, true)

    const candidates = await request(`${baseUrl}/api/collections/candidates/records?filter=${encodeURIComponent("wordpress_candidatura_id='runtime-closed-1'")}`)
    assert.equal(candidates.status, 200, candidates.raw)
    assert.equal(candidates.body.items.length, 1)
    assert.equal(candidates.body.items[0].vacancy_id, 'vacancyclosed01')

    const logs = await request(`${baseUrl}/api/collections/wordpress_import_logs/records?perPage=100`)
    assert.equal(logs.status, 200, logs.raw)
    const audit = logs.body.items.find((item) => String(item.mensagem).includes('rh-admin'))
    assert.ok(audit, 'override audit log missing')
    assert.match(audit.mensagem, /Homologação explícita/)

    console.log('wordpress candidate guard PocketBase 0.36.3 runtime contracts passed')
  } finally {
    child.kill('SIGTERM')
    await new Promise((resolve) => {
      if (child.exitCode !== null) return resolve()
      child.once('exit', resolve)
      setTimeout(() => { child.kill('SIGKILL'); resolve() }, 3000).unref()
    })
    fs.rmSync(workspace, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error.stack || error)
  fs.rmSync(workspace, { recursive: true, force: true })
  process.exitCode = 1
})
