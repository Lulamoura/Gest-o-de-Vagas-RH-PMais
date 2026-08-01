import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Code,
  Eye,
  RemoveFormatting,
} from 'lucide-react'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  availableVariables?: { key: string; label: string }[]
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Escreva o conteúdo do e-mail...',
  availableVariables = [],
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [showHtml, setShowHtml] = useState(false)

  useEffect(() => {
    if (editorRef.current && !showHtml) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || ''
      }
    }
  }, [value, showHtml])

  const execCommand = (command: string, arg?: string) => {
    document.execCommand(command, false, arg)
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }

  const handleInsertVariable = (varKey: string) => {
    const token = `{{${varKey}}}`
    if (showHtml) {
      onChange((value || '') + token)
      return
    }
    if (editorRef.current) {
      editorRef.current.focus()
      document.execCommand('insertText', false, token)
      onChange(editorRef.current.innerHTML)
    }
  }

  return (
    <div className="border border-slate-200 rounded-md overflow-hidden bg-white shadow-2xs">
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-slate-200 bg-slate-50 text-slate-700">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('bold')}
          className="h-8 w-8 p-0"
          title="Negrito"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('italic')}
          className="h-8 w-8 p-0"
          title="Itálico"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('underline')}
          className="h-8 w-8 p-0"
          title="Sublinhado"
        >
          <Underline className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('strikeThrough')}
          className="h-8 w-8 p-0"
          title="Tachado"
        >
          <Strikethrough className="h-4 w-4" />
        </Button>

        <div className="h-4 w-px bg-slate-300 mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('formatBlock', '<h2>')}
          className="h-8 w-8 p-0"
          title="Título H2"
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('formatBlock', '<h3>')}
          className="h-8 w-8 p-0"
          title="Subtítulo H3"
        >
          <Heading3 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('insertUnorderedList')}
          className="h-8 w-8 p-0"
          title="Lista com Marcadores"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('insertOrderedList')}
          className="h-8 w-8 p-0"
          title="Lista Numerada"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>

        <div className="h-4 w-px bg-slate-300 mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('removeFormat')}
          className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900"
          title="Remover Formatação"
        >
          <RemoveFormatting className="h-4 w-4" />
        </Button>

        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant={showHtml ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setShowHtml(!showHtml)}
            className="h-8 px-2 text-xs font-medium text-slate-700 hover:text-slate-900"
          >
            {showHtml ? (
              <>
                <Eye className="h-3.5 w-3.5 mr-1" /> Mod Visual
              </>
            ) : (
              <>
                <Code className="h-3.5 w-3.5 mr-1" /> Editar HTML
              </>
            )}
          </Button>
        </div>
      </div>

      {availableVariables.length > 0 && (
        <div className="p-2 bg-slate-100/80 border-b border-slate-200 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-semibold text-slate-600 mr-1">Inserir Variável:</span>
          {availableVariables.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => handleInsertVariable(v.key)}
              className="px-2 py-0.5 rounded bg-white hover:bg-indigo-50 border border-slate-300 hover:border-indigo-300 text-indigo-700 font-mono text-[11px] font-medium transition-colors shadow-2xs"
            >
              + {v.label}
            </button>
          ))}
        </div>
      )}

      {showHtml ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-h-[220px] p-3 font-mono text-xs text-slate-100 bg-slate-900 focus:outline-none resize-y"
          placeholder={placeholder}
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          onInput={() => {
            if (editorRef.current) {
              onChange(editorRef.current.innerHTML)
            }
          }}
          className="min-h-[220px] p-3 text-slate-800 focus:outline-none prose prose-slate max-w-none text-sm leading-relaxed"
          style={{ wordBreak: 'break-word' }}
        />
      )}
    </div>
  )
}
