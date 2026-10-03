'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const root = path.resolve(__dirname, '..')
const source = fs.readFileSync(
  path.join(root, 'pocketbase/hooks/requisition_wordpress_draft.js'),
  'utf8',
)
const routes = []
const context = {
  console,
  TextDecoder,
  routerAdd(method, route, handler) {
    routes.push({ method, route, handler })
  },
  $apis: { requireAuth: () => ({}) },
}
vm.createContext(context)
vm.runInContext(source, context, { filename: 'requisition_wordpress_draft.js' })

assert.equal(typeof context.findProtectedCriterion, 'function')
assert.equal(typeof context.normalizeProtectedCriteriaText, 'function')
assert.equal(routes.length, 2)

const cases = [
  ['age', 'Ter ATÉ 30 anos'],
  ['gender_sex', 'Exigir GÊNERO feminino'],
  ['marital_status', 'Estado CÍVIL casado'],
  ['religion', 'RELIGIÃO católica'],
  ['health_disability', 'Exigir SaÚdE perfeita e ausência de deficiência'],
  ['address_neighborhood', 'Residir no BAIRRO Boa Viagem'],
  ['race_ethnicity', 'Preferência de RAÇA branca'],
  ['sexual_orientation', 'ORIENTAÇÃO SEXUAL heterossexual'],
  ['pregnancy', 'Não estar GRÁVIDA'],
  ['appearance_photo', 'Exigir BOA APARÊNCIA e FOTO recente'],
  ['children_dependents_family_status', 'Não ter FILHOS ou DEPENDENTES'],
  ['children_dependents_family_status', 'Situação FAMILIAR estável'],
]

for (const [category, text] of cases) {
  const result = context.findProtectedCriterion({
    titulo_publico: 'Analista administrativo',
    descricao_publica: 'Atividades profissionais objetivas.',
    perfil_interno_triagem: text,
  })
  assert.ok(result, `expected protected criterion for: ${text}`)
  assert.equal(result.field, 'perfil_interno_triagem', text)
  assert.equal(result.category, category, text)
}

assert.equal(
  context.findProtectedCriterion({
    titulo_publico: 'Analista administrativo',
    descricao_publica: 'Organizar documentos e atender clientes.',
    perfil_interno_triagem: 'Validar experiência com Excel e rotinas administrativas.',
  }),
  null,
)

assert.equal(
  context.findProtectedCriterion({
    titulo_publico: 'Analista administrativo',
    descricao_publica:
      'Plano de saúde. Endereço do escritório disponível após a seleção. Ambiente acessível para pessoas com deficiência.',
    perfil_interno_triagem:
      'Não discriminar por idade. Aceitar vaga afirmativa para PCD e benefícios para filhos ou dependentes.',
  }),
  null,
)

for (const field of ['titulo_publico', 'descricao_publica', 'perfil_interno_triagem']) {
  const reviewed = {
    titulo_publico: 'Analista administrativo',
    descricao_publica: 'Atividades profissionais objetivas.',
    perfil_interno_triagem: 'Validar experiência profissional.',
  }
  reviewed[field] = 'Critério de IDADE mínima'
  assert.equal(context.findProtectedCriterion(reviewed).field, field)
}

console.log(`PASS ${cases.length} protected-category cases plus exact reviewed fields`)
