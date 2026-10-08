'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const authSource = fs.readFileSync(path.join(root, 'src/hooks/use-auth.tsx'), 'utf8')

assert.equal(
  authSource.includes('.authWithPassword('),
  false,
  'use-auth must not bypass the controlled access login route',
)
assert.equal(
  authSource.includes('.authRefresh('),
  false,
  'use-auth must validate sessions without rotating a remote token',
)
const signInBlock = authSource.slice(
  authSource.indexOf('const signIn = async'),
  authSource.indexOf('const verifyRemoteCode = async'),
)
const verifyBlock = authSource.slice(
  authSource.indexOf('const verifyRemoteCode = async'),
  authSource.indexOf('const resendRemoteCode = async'),
)
assert.match(signInBlock, /pb\.authStore\.clear\(\)/)
assert.match(verifyBlock, /pb\.authStore\.clear\(\)/)
assert.match(authSource, /startAccessLogin\(email, password\)/)
assert.match(authSource, /verifyRemoteAccessCode\(challengeId, code\)/)
assert.match(authSource, /validateAccessSession\(\)/)
assert.match(authSource, /resendRemoteAccessCode\(challengeId\)/)

const loginSource = fs.readFileSync(path.join(root, 'src/pages/Login.tsx'), 'utf8')
assert.match(loginSource, /verifyRemoteCode/)
assert.match(loginSource, /resendRemoteCode/)
assert.match(loginSource, /challenge\.maskedEmail/)
assert.match(loginSource, /Acesso remoto não autorizado/)
assert.match(loginSource, /pattern="\[0-9\]\{6\}"/)
assert.equal(
  /id=["']otp-email["']/.test(loginSource),
  false,
  'the OTP screen must not accept a browser-supplied email address',
)

const usersSource = fs.readFileSync(path.join(root, 'src/pages/Users.tsx'), 'utf8')
const typesSource = fs.readFileSync(path.join(root, 'src/types/index.ts'), 'utf8')
const parametersSource = fs.readFileSync(
  path.join(root, 'src/components/SystemParametersForm.tsx'),
  'utf8',
)
assert.match(typesSource, /permitir_acesso_fora_pmais\??:\s*boolean/)
assert.match(usersSource, /Permitir acesso fora da PMais/)
assert.match(usersSource, /setRemoteAccessPermission/)
assert.match(usersSource, /setUserActiveStatus/)
assert.equal(/setUserAtivo/.test(usersSource), false)
assert.match(usersSource, /permitir_acesso_fora_pmais:\s*false/)
assert.match(usersSource, /Parameters<typeof createUser>\[0\]/)
assert.equal(
  /updateData\.permitir_acesso_fora_pmais\s*=/.test(usersSource),
  false,
  'remote permission must not use the generic users update API',
)
assert.ok(
  usersSource.indexOf('setRemoteAccessPermission(editingUser.id, false)') <
    usersSource.indexOf("updateUser(editingUser.id, updateData"),
  'revocation must happen before profile/department changes',
)
assert.ok(
  usersSource.indexOf("updateUser(editingUser.id, updateData") <
    usersSource.indexOf('setRemoteAccessPermission(editingUser.id, true)'),
  'remote grant must happen only after profile/department changes',
)
assert.match(parametersSource, /Restringir acesso à rede da PMais/)
assert.match(parametersSource, /143\.208\.130\.134\/32/)
assert.match(parametersSource, /prefix !== 32/)
assert.match(parametersSource, /canonical !== network/)
assert.match(parametersSource, /setRemoteAccessSettings/)
assert.match(parametersSource, /setRemoteAccessSettings\(\s*restringirAcessoRedePmais/)
assert.equal(
  /const data = \{[\s\S]*restringir_acesso_rede_pmais/.test(parametersSource),
  false,
  'remote settings must not use the generic system_parameters update payload',
)
assert.equal(/deleteSystemParameters/.test(parametersSource), false)
assert.equal(/createSystemParameters/.test(parametersSource), false)
assert.equal(/>Excluir</.test(parametersSource), false)

console.log('remote access frontend authentication wiring contract passed')
