'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const hook = fs.readFileSync(
  path.join(root, 'pocketbase/hooks/enforce_user_ativo.js'),
  'utf8',
)
const profileHook = fs.readFileSync(
  path.join(root, 'pocketbase/hooks/enforce_profile_update.js'),
  'utf8',
)
const migration = fs.readFileSync(
  path.join(root, 'pocketbase/migrations/0078_add_remote_access_control.js'),
  'utf8',
)

assert.match(hook, /onRealtimeConnectRequest\s*\(/)
assert.match(hook, /onRealtimeSubscribeRequest\s*\(/)
assert.match(hook, /onRealtimeMessageSend\s*\(/)
assert.match(hook, /remote_access_sessions/)
const otpIssueBlock = hook.slice(
  hook.indexOf("if (!isOfficeIp) {"),
  hook.indexOf("var senderName = 'PMais RH'"),
)
assert.match(otpIssueBlock, /runInTransaction/)
assert.equal(
  /remote_access_(sessions|challenges)[\s\S]{0,180}\n\s*500,/.test(hook),
  false,
  'security revocation must not cap results at 500',
)
assert.match(hook, /while \(true\)/)
assert.match(hook, /GV_RH_TRUSTED_PROXY_IPS/)
assert.match(hook, /requestPath === '\/backend\/v1\/curriculum-feedback\/commit'/)
const integrationExceptionStart = hook.indexOf(
  "requestPath === '/backend/v1/curriculum-feedback/commit'",
)
const integrationExceptionBlock = hook.slice(
  integrationExceptionStart,
  hook.indexOf('var deny = function', integrationExceptionStart),
)
assert.match(integrationExceptionBlock, /PMAIS_IRIS_GV_HMAC_SECRET/)
assert.match(integrationExceptionBlock, /\$security\.hs256/)
assert.equal(
  /candidate-public-data\/\*/.test(hook),
  false,
  'candidate public exemption must be exact, not a wildcard',
)
assert.match(profileHook, /estado de acesso deve ser alterado pela rota administrativa segura/i)
assert.match(hook, /remote_access_artifacts_revoked_for_deactivation/)
assert.match(hook, /user_deactivated/)
assert.match(hook, /user_reactivated/)
assert.match(migration, /Remote access migration collision/)
assert.match(migration, /migrationCollisions/)

console.log('remote access backend enforcement contract passed')
