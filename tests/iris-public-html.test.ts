// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { sanitizeIrisPublicHtml } from '../src/lib/iris-public-html'

describe('sanitizeIrisPublicHtml', () => {
  it('preserves only the visual-editor allowlist without rewriting safe reviewed HTML', () => {
    const reviewed =
      '<p>P<br><strong>S</strong><b>B</b><em>E</em><i>I</i><u>U</u><s>X</s></p><h2>H2</h2><h3>H3</h3><ul><li>U</li></ul><ol><li>O</li></ol>'

    expect(sanitizeIrisPublicHtml(reviewed)).toBe(reviewed)
  })

  it.each([
    ['<img src="x" onerror="alert(1)"><p>Texto</p>', '<p>Texto</p>'],
    ['<p onclick="alert(1)">Texto</p>', '<p>Texto</p>'],
    ['<script>alert(1)</script><p>Texto</p>', '<p>Texto</p>'],
    ['<a href="javascript:alert(1)">Texto</a>', 'Texto'],
    ['<div data-private="x">Texto</div>', 'Texto'],
  ])('removes unsafe or unsupported markup from %s', (unsafeHtml, expected) => {
    expect(sanitizeIrisPublicHtml(unsafeHtml)).toBe(expected)
  })
})
