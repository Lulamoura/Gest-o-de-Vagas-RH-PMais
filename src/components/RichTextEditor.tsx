import { useRef, useEffect, useCallback, useState } from 'react'
import { Bold, Italic, Underline, List, ListOrdered, Link2, Palette, Variable } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface Placeholder {
  token: string
  description: string
}

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholders?: Placeholder[]
}

const FONT_SIZES = [
  { label: 'Pequeno', value: '2' },
  { label: 'Normal', value: '3' },
  { label: 'Grande', value: '5' },
  { label: 'Muito Grande', value: '6' },
]

const COLORS = [
  '#000000',
  '#374151',
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#2563eb',
  '#7c3aed',
  '#db2777',
]

export function RichTextEditor({ value, onChange, placeholders = [] }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const isInternalChange = useRef(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkOpen, setLinkOpen] = useState(false)

  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || '<p></p>'
      }
    }
    isInternalChange.current = false
  }, [value])

  const handleInput = useCallback(() => {
    isInternalChange.current = true
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }, [onChange])

  const exec = useCallback(
    (command: string, val?: string) => {
      document.execCommand('styleWithCSS', false, 'false')
      document.execCommand(command, false, val)
      editorRef.current?.focus()
      handleInput()
    },
    [handleInput],
  )

  const insertPlaceholder = useCallback(
    (token: string) => {
      document.execCommand('insertHTML', false, token)
      editorRef.current?.focus()
      handleInput()
    },
    [handleInput],
  )

  const applyLink = useCallback(() => {
    if (linkUrl.trim()) exec('createLink', linkUrl.trim())
    setLinkOpen(false)
    setLinkUrl('')
  }, [linkUrl, exec])

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-slate-200 bg-slate-50">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => exec('bold')}
          title="Negrito"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => exec('italic')}
          title="Itálico"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => exec('underline')}
          title="Sublinhado"
        >
          <Underline className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-slate-200 mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => exec('insertUnorderedList')}
          title="Lista"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => exec('insertOrderedList')}
          title="Lista numerada"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-slate-200 mx-1" />
        <Popover open={linkOpen} onOpenChange={setLinkOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" title="Inserir link">
              <Link2 className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3">
            <div className="flex gap-2">
              <Input
                placeholder="https://..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    applyLink()
                  }
                }}
                autoFocus
              />
              <Button type="button" size="sm" onClick={applyLink}>
                OK
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <select
          className="h-8 text-xs border border-slate-200 rounded px-1 bg-white cursor-pointer"
          onChange={(e) => {
            if (e.target.value) exec('fontSize', e.target.value)
            e.target.selectedIndex = 0
          }}
          defaultValue=""
        >
          <option value="" disabled>
            Tamanho
          </option>
          {FONT_SIZES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" title="Cor do texto">
              <Palette className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">
            <div className="grid grid-cols-3 gap-1">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="w-6 h-6 rounded border border-slate-200 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  onClick={() => exec('foreColor', color)}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>
        {placeholders.length > 0 && (
          <>
            <div className="w-px h-6 bg-slate-200 mx-1" />
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="ghost" size="sm" title="Inserir variável">
                  <Variable className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-1">
                {placeholders.map((p) => (
                  <button
                    key={p.token}
                    type="button"
                    className="flex flex-col w-full text-left px-2 py-1.5 rounded hover:bg-slate-100 text-xs"
                    onClick={() => insertPlaceholder(p.token)}
                  >
                    <code className="font-mono text-indigo-600">{p.token}</code>
                    <span className="text-slate-500">{p.description}</span>
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </>
        )}
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        className="min-h-[200px] max-h-[400px] overflow-y-auto p-4 text-sm outline-none prose prose-sm max-w-none focus:outline-none [&_a]:text-indigo-600 [&_a]:underline"
      />
    </div>
  )
}
