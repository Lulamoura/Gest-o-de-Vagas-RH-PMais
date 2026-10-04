import { describe, expect, it } from 'vitest'

import { isRhDepartmentName } from '@/lib/auth'

describe('RH department gate', () => {
  it.each([
    ['RH', true],
    ['rh', true],
    ['  rH\n', true],
    ['Comercial', false],
  ])('normalizes department name %j', (departmentName, expected) => {
    expect(isRhDepartmentName(departmentName)).toBe(expected)
  })
})
