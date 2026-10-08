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
assert(fs.existsSync(POCKETBASE), `PocketBase binary not found: ${POCKETBASE}`)
const version = spawnSync(POCKETBASE, ['--version'], { encoding: 'utf8' })
assert.equal(version.status, 0, version.stderr)
assert.match(version.stdout, /0\.36\.3\b/, `expected PocketBase 0.36.3, got ${version.stdout.trim()}`)

const workspace = fs.mkdtempSync(
  path.join(process.env.TMPDIR || os.tmpdir(), 'gv-rh-remote-access-pb036-'),
)
const dataDirectory = path.join(workspace, 'data')
const migrationsDirectory = path.join(workspace, 'migrations')
const hooksDirectory = path.join(workspace, 'hooks')
const emptyHooksDirectory = path.join(workspace, 'empty-hooks')
for (const directory of [migrationsDirectory, hooksDirectory, emptyHooksDirectory]) {
  fs.mkdirSync(directory, { recursive: true })
}

const setupMigration = `migrate(
  function (app) {
    var users = app.findCollectionByNameOrId('users')
    users.listRule = null
    users.viewRule = null
    users.createRule = null
    users.updateRule = null
    users.deleteRule = null
    users.fields.add(new SelectField({
      name: 'profile',
      values: ['admin', 'operator', 'viewer', 'superadmin'],
      maxSelect: 1,
    }))
    users.fields.add(new BoolField({ name: 'ativo', required: false }))
    app.save(users)

    var parameters = new Collection({
      type: 'base',
      name: 'system_parameters',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.profile = 'superadmin'",
      updateRule: "@request.auth.profile = 'superadmin'",
      deleteRule: "@request.auth.profile = 'superadmin'",
    })
    parameters.fields.add(new TextField({ name: 'key', required: true, max: 80 }))
    parameters.fields.add(new TextField({ name: 'value', required: false, max: 500 }))
    app.save(parameters)

    var parameter = new Record(parameters)
    parameter.set('key', 'default')
    parameter.set('value', 'baseline')
    app.save(parameter)
  },
  function (_) {},
)`
fs.writeFileSync(path.join(migrationsDirectory, '0077_remote_access_runtime_setup.js'), setupMigration)

const featureMigration = path.join(
  ROOT,
  'pocketbase',
  'migrations',
  '0078_add_remote_access_control.js',
)
if (fs.existsSync(featureMigration)) {
  fs.copyFileSync(featureMigration, path.join(migrationsDirectory, path.basename(featureMigration)))
}

const probeHook = `routerAdd('GET', '/test/remote-access-schema', function (e) {
  var fieldExists = function (collection, name) {
    try {
      return !!collection.fields.getByName(name)
    } catch (_) {
      return false
    }
  }
  var collectionInfo = function (name) {
    try {
      var collection = $app.findCollectionByNameOrId(name)
      return {
        exists: true,
        rulesClosed:
          collection.listRule === null &&
          collection.viewRule === null &&
          collection.createRule === null &&
          collection.updateRule === null &&
          collection.deleteRule === null,
        indexes: collection.indexes || [],
      }
    } catch (_) {
      return { exists: false, rulesClosed: false, indexes: [] }
    }
  }

  var users = $app.findCollectionByNameOrId('users')
  var parameters = $app.findCollectionByNameOrId('system_parameters')
  var parameter = null
  try {
    parameter = $app.findFirstRecordByData('system_parameters', 'key', 'default')
  } catch (_) {}

  return e.json(200, {
    users: {
      remoteField: fieldExists(users, 'permitir_acesso_fora_pmais'),
    },
    parameters: {
      restrictionField: fieldExists(parameters, 'restringir_acesso_fora_pmais'),
      networksField: fieldExists(parameters, 'redes_autorizadas_pmais'),
      restrictionEnabled: parameter
        ? parameter.getBool('restringir_acesso_fora_pmais')
        : null,
      networks: parameter ? parameter.getString('redes_autorizadas_pmais') : null,
    },
    challenges: collectionInfo('remote_access_challenges'),
    sessions: collectionInfo('remote_access_sessions'),
    audit: collectionInfo('remote_access_audit'),
    rateLimits: collectionInfo('remote_access_rate_limits'),
  })
})`
fs.writeFileSync(path.join(hooksDirectory, 'remote_access_schema_probe.pb.js'), probeHook)

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

function request(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let raw = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => {
        raw += chunk
      })
      res.on('end', () => {
        let body = null
        try {
          body = raw ? JSON.parse(raw) : null
        } catch (_) {}
        resolve({ status: res.statusCode, body, raw })
      })
    })
    req.once('error', reject)
  })
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

async function main() {
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
  let server = spawn(
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
  let rollbackServer = null

  try {
    await waitForReady(baseUrl, server, output)
    const response = await request(`${baseUrl}/test/remote-access-schema`)
    assert.equal(response.status, 200, response.raw)
    assert.equal(response.body.users.remoteField, true, 'remote user permission field missing')
    assert.equal(response.body.parameters.restrictionField, true, 'global restriction field missing')
    assert.equal(response.body.parameters.networksField, true, 'office networks field missing')
    assert.equal(response.body.parameters.restrictionEnabled, false)
    assert.equal(response.body.parameters.networks, '143.208.130.134/32')
    for (const name of ['challenges', 'sessions', 'audit', 'rateLimits']) {
      assert.equal(response.body[name].exists, true, `${name} collection missing`)
      assert.equal(response.body[name].rulesClosed, true, `${name} direct API rules must be closed`)
    }
    assert.ok(
      response.body.sessions.indexes.some((value) => String(value).includes('token_digest')),
      'remote session token digest index missing',
    )
    assert.ok(
      response.body.challenges.indexes.some((index) =>
        index.includes('idx_remote_access_challenges_active_user'),
      ),
      response.body.challenges.indexes.join('\n'),
    )
    await stopServer(server)
    server = null
    const rollback = spawnSync(
      POCKETBASE,
      [
        'migrate',
        'down',
        '1',
        '--dir',
        dataDirectory,
        '--migrationsDir',
        migrationsDirectory,
        '--hooksDir',
        emptyHooksDirectory,
        '--automigrate=false',
        '--dev=false',
      ],
      { cwd: ROOT, encoding: 'utf8', input: 'y\n' },
    )
    assert.equal(
      rollback.status,
      0,
      `PocketBase rollback failed\n${rollback.stdout || ''}${rollback.stderr || ''}`,
    )

    const rolledBackMigrationPath = path.join(migrationsDirectory, path.basename(featureMigration))
    fs.renameSync(rolledBackMigrationPath, `${rolledBackMigrationPath}.disabled`)

    const rollbackPort = await reservePort()
    const rollbackBaseUrl = `http://127.0.0.1:${rollbackPort}`
    rollbackServer = spawn(
      POCKETBASE,
      [
        'serve',
        `--http=127.0.0.1:${rollbackPort}`,
        '--dir',
        dataDirectory,
        '--migrationsDir',
        migrationsDirectory,
        '--hooksDir',
        hooksDirectory,
        '--automigrate=false',
        '--dev=true',
      ],
      { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let rollbackOutputText = ''
    rollbackServer.stdout.on('data', (chunk) => {
      rollbackOutputText += chunk
    })
    rollbackServer.stderr.on('data', (chunk) => {
      rollbackOutputText += chunk
    })
    const rollbackOutput = () => rollbackOutputText
    await waitForReady(rollbackBaseUrl, rollbackServer, rollbackOutput)
    const rolledBack = await request(`${rollbackBaseUrl}/test/remote-access-schema`)
    assert.equal(rolledBack.status, 200, rolledBack.raw)
    assert.equal(
      rolledBack.body.users.remoteField,
      false,
      `${JSON.stringify(rolledBack.body)}\n${rollback.stdout || ''}${rollback.stderr || ''}`,
    )
    assert.equal(rolledBack.body.parameters.restrictionField, false)
    assert.equal(rolledBack.body.parameters.networksField, false)
    for (const name of ['challenges', 'sessions', 'audit', 'rateLimits']) {
      assert.equal(rolledBack.body[name].exists, false, `${name} survived rollback`)
    }
    console.log('remote access PocketBase 0.36.3 migration and rollback contracts passed')
  } finally {
    await stopServer(server)
    await stopServer(rollbackServer)
    if (process.env.KEEP_REMOTE_ACCESS_TEST_WORKSPACE !== '1') {
      fs.rmSync(workspace, { recursive: true, force: true })
    }
  }
}

main().catch((error) => {
  console.error(error)
  if (process.env.KEEP_REMOTE_ACCESS_TEST_WORKSPACE === '1') {
    console.error(`workspace preserved at ${workspace}`)
  } else {
    fs.rmSync(workspace, { recursive: true, force: true })
  }
  process.exitCode = 1
})
