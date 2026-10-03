import DOMPurify from 'dompurify'

const IRIS_PUBLIC_HTML_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
] as const

export function sanitizeIrisPublicHtml(value: string): string {
  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS: [...IRIS_PUBLIC_HTML_TAGS],
    ALLOWED_ATTR: [],
  })
}
