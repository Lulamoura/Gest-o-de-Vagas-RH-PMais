import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.resolve(import.meta.dirname, '..')

describe('tamanhos de fardamento', () => {
  it('oferece XG e XGG no formulário público do candidato', () => {
    const source = fs.readFileSync(path.join(root, 'src/pages/CandidatePublicForm.tsx'), 'utf8')
    const options = [...source.matchAll(/<SelectItem value="([^"]+)">\1<\/SelectItem>/g)].map(
      (match) => match[1],
    )

    expect(options).toEqual(['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG'])
  })

  it('oferece XG e XGG na edição de candidato dentro do GV', () => {
    const source = fs.readFileSync(path.join(root, 'src/pages/Candidates.tsx'), 'utf8')
    const uniformField = source.match(
      /<Label[^>]*>Tamanho Fardamento<\/Label>[\s\S]*?<SelectContent>([\s\S]*?)<\/SelectContent>/,
    )
    const options = [...(uniformField?.[1] || '').matchAll(/<SelectItem value="([^"]+)">\1<\/SelectItem>/g)].map(
      (match) => match[1],
    )

    expect(options).toEqual(['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG'])
  })

  it('aceita XG e XGG no contrato de dados do candidato', () => {
    const schema = JSON.parse(
      fs.readFileSync(path.join(root, 'src/lib/pocketbase/schema.json'), 'utf8'),
    )
    const candidates = schema.collections.find(
      (collection: { name?: string }) => collection.name === 'candidates',
    )
    const uniformSize = candidates.fields.find(
      (field: { name?: string }) => field.name === 'tamanho_fardamento',
    )

    expect(uniformSize.selectValues).toEqual(['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG'])
  })

  it('migra o campo existente sem alterar registros de candidatos', () => {
    const migrationPath = path.join(
      root,
      'pocketbase/migrations/0079_expand_candidate_uniform_sizes.js',
    )
    expect(fs.existsSync(migrationPath)).toBe(true)

    const source = fs.readFileSync(migrationPath, 'utf8')
    expect(source).toMatch(/findCollectionByNameOrId\('candidates'\)/)
    expect(source).toMatch(/getByName\('tamanho_fardamento'\)/)
    expect(source).toContain("['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG']")
    expect(source).not.toMatch(/findRecords|newQuery|app\.save\([^c]/)
  })
})
