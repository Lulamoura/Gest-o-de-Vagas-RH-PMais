'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const hook = fs.readFileSync(
  path.join(root, 'pocketbase/hooks/enforce_user_ativo.js'),
  'utf8',
)

const routePath = '/backend/v1/access/integrations/iris/rh-reporting/snapshot'
const routePathIndex = hook.indexOf(`'${routePath}'`)
assert.notEqual(routePathIndex, -1, 'general Íris RH reporting snapshot route must exist')
const routeStart = hook.lastIndexOf('routerAdd(', routePathIndex)
const nextRoute = hook.indexOf("'/backend/v1/access/login'", routePathIndex)
const routeEnd = hook.lastIndexOf('routerAdd(', nextRoute)
const route = hook.slice(routeStart, routeEnd === -1 ? hook.length : routeEnd)

for (const required of [
  'PMAIS_IRIS_RH_REPORT_HMAC_SECRET',
  'PMAIS_IRIS_GV_HMAC_SECRET',
  'PMAIS_RH_CONSULTIVO_GV_PREVIEW_HMAC_SECRET',
  'GV_RH_ACCESS_HMAC_SECRET',
  'WORDPRESS_INTEGRATION_TOKEN',
  'WORDPRESS_CLOSED_VACANCY_OVERRIDE_TOKEN',
  'PMAIS_IRIS_GV_PROOF_SECRET',
  'PMAIS_IRIS_GV_API_KEY',
  'RESEND_API_KEY',
  'ESCAVADOR_API_TOKEN',
  'X-PMais-Iris-RH-Reporting-Timestamp',
  'X-PMais-Iris-RH-Reporting-Signature',
  '$security.hs256',
  '$security.equal',
  "'vacancies'",
  "'candidates'",
  "'pipeline_history'",
  "'candidate_history'",
  "'professional'",
  "'contact'",
  'wordpress_application_id',
  'candidate_field_set',
  'Cache-Control',
  'no-store',
]) {
  assert.ok(route.includes(required), `route is missing ${required}`)
}

assert.match(route, /reportSecret\.length\s*<\s*32/)
assert.match(route, /reportSecret\s*===\s*conflictingSecrets\[reportConflictIndex\]/)
assert.match(route, /reportSecretConflict/)
assert.match(route, /Math\.abs\([\s\S]*?>\s*60/)
assert.match(route, /while\s*\(true\)/)
assert.match(route, /findRecordsByFilter\([\s\S]*?500,[\s\S]*?offset/)
assert.equal(/offset\s*>/.test(route), false, 'complete pagination must not have a silent cap')
assert.match(route, /schema_version:\s*1/)
assert.match(route, /generated_at:/)
assert.match(route, /resources:/)

for (const forbidden of [
  '$app.save(',
  'txApp.save(',
  'reportApp.save(',
  '$app.delete(',
  'txApp.delete(',
  'reportApp.delete(',
  'new Record(',
  'recordAuthResponse',
  'findAuthRecordByEmail',
  'auth-with-password',
  'Authorization',
  'Bearer',
  'PMAIS_GV_USER',
  'PMAIS_GV_PASS',
]) {
  assert.equal(route.includes(forbidden), false, `read-only route must not use ${forbidden}`)
}

for (const forbiddenCandidateRead of [
  'cpf',
  'rg',
  'data_nascimento',
  'nome_pai',
  'nome_mae',
  'telefone_emergencia',
  'tamanho_fardamento',
  'tamanho_sapato',
  'vale_transporte_qtd',
  'observacao',
  'observacoes',
  'informacoes_integracao',
]) {
  assert.equal(
    new RegExp(`candidate\\.get(?:String|Bool|Int|Float)?\\(['\"]${forbiddenCandidateRead}['\"]\\)`).test(route),
    false,
    `route must not read candidate field ${forbiddenCandidateRead}`,
  )
}

assert.equal(
  /candidate\.getString\(['"]nome['"]\)[\s\S]{0,200}(dedupe|seen|key)/i.test(route),
  false,
  'candidate names must never be deduplication keys',
)

console.log('Íris general RH reporting snapshot static contract passed')
