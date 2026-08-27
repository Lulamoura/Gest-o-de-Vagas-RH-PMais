import React, { useState, useEffect, useRef } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Send,
  Bot,
  User,
  RotateCcw,
  Sparkles,
  Loader2,
  BookOpen,
  Plus,
  MessageSquare,
  AlertCircle,
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import {
  streamAgentChat,
  displayableMessages,
  type DisplayMessage,
  type AgentMessage,
  type AgentCitation,
} from '@/lib/skipAi'

interface AssistantChatDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ConversationItem {
  id: string
  title?: string
  created: string
  updated: string
}

export function AssistantChatDrawer({ open, onOpenChange }: AssistantChatDrawerProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isStreaming])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 150)
      loadConversations()
    } else {
      // Abort in-flight stream if drawer closes
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
    }
  }, [open])

  const loadConversations = async () => {
    try {
      const pbUrl = import.meta.env.VITE_POCKETBASE_URL || ''
      const res = await fetch(`${pbUrl}/backend/v1/agent/laika/conversations?limit=15`, {
        headers: {
          Authorization: pb.authStore.token,
        },
      })
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data.items)) {
        setConversations(data.items)
      }
    } catch (_) {
      // Silent error on listing conversations
    }
  }

  const loadConversationMessages = async (convId: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const pbUrl = import.meta.env.VITE_POCKETBASE_URL || ''
      const res = await fetch(
        `${pbUrl}/backend/v1/agent/laika/conversations/${convId}/messages?limit=50`,
        {
          headers: {
            Authorization: pb.authStore.token,
          },
        },
      )
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || 'Erro ao carregar histórico da conversa')
      }
      const data = (await res.json()) as { messages: AgentMessage[] }
      const displayMsgs = displayableMessages(data.messages || [])
      setMessages(displayMsgs)
      setConversationId(convId)
      setShowHistory(false)
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Falha ao carregar mensagens'
      setError(errMsg)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartNewChat = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setConversationId(null)
    setMessages([])
    setError(null)
    setShowHistory(false)
    setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
  }

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmedInput = input.trim()
    if (!trimmedInput || isLoading || isStreaming) return

    const userMsgId = `usr_${Date.now()}`
    const userMsg: DisplayMessage = {
      id: userMsgId,
      role: 'user',
      content: trimmedInput,
      created: new Date().toISOString(),
    }

    const assistantMsgId = `ast_${Date.now()}`
    const initialAssistantMsg: DisplayMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      created: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMsg, initialAssistantMsg])
    setInput('')
    setError(null)
    setIsStreaming(true)

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    const pbUrl = import.meta.env.VITE_POCKETBASE_URL || ''

    try {
      const res = await fetch(`${pbUrl}/backend/v1/agent/laika/chat-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: pb.authStore.token,
        },
        body: JSON.stringify({
          message: trimmedInput,
          conversation_id: conversationId,
        }),
        signal: abortController.signal,
      })

      let currentCitations: AgentCitation[] | undefined

      const result = await streamAgentChat(res, {
        onChunk: (_delta, accumulated) => {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === assistantMsgId ? { ...msg, content: accumulated } : msg)),
          )
        },
        onCitations: (items) => {
          currentCitations = items
          setMessages((prev) =>
            prev.map((msg) => (msg.id === assistantMsgId ? { ...msg, citations: items } : msg)),
          )
        },
        onError: (errMessage) => {
          setError(errMessage)
        },
        signal: abortController.signal,
      })

      const resolvedConvId =
        res.headers.get('X-Conversation-Id') || result.conversation_id || conversationId
      if (resolvedConvId && resolvedConvId !== conversationId) {
        setConversationId(resolvedConvId)
        loadConversations()
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: result.content || msg.content,
                citations: result.citations || currentCitations,
              }
            : msg,
        ),
      )
    } catch (err: unknown) {
      if (abortController.signal.aborted) {
        // User aborted or drawer closed
        return
      }
      const errMsg =
        err instanceof Error ? err.message : 'Falha ao processar resposta do assistente'
      setError(errMsg)
      // Keep whatever was streamed or show error placeholder
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId && !msg.content
            ? {
                ...msg,
                content:
                  'Desculpe, ocorreu uma instabilidade temporária ao gerar a resposta. Por favor, tente novamente.',
              }
            : msg,
        ),
      )
    } finally {
      setIsStreaming(false)
      abortControllerRef.current = null
      setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
    }
  }

  const suggestedQuestions = [
    'Quais são as vagas abertas atualmente?',
    'Como está o status das requisições pendentes?',
    'Qual o procedimento para integração de novos colaboradores?',
    'Resumo dos principais indicadores deste mês.',
  ]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg md:max-w-xl p-0 flex flex-col h-full bg-slate-900 border-l border-slate-800 text-slate-100 shadow-2xl"
      >
        {/* Drawer Header */}
        <SheetHeader className="px-5 py-4 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 p-0.5 flex items-center justify-center shadow-md shrink-0">
                <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
                  <Bot className="h-5 w-5 text-indigo-400 animate-pulse" />
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <SheetTitle className="text-base font-bold text-white tracking-tight">
                    Assistente Laika
                  </SheetTitle>
                  <Badge
                    variant="outline"
                    className="bg-indigo-500/10 text-indigo-300 border-indigo-500/30 text-[10px] px-1.5 py-0 h-4 font-normal"
                  >
                    AI RH
                  </Badge>
                </div>
                <SheetDescription className="text-xs text-slate-400 truncate">
                  Assistente inteligente do RH da PMais
                </SheetDescription>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowHistory(!showHistory)}
                className={`h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800 ${
                  showHistory ? 'bg-slate-800 text-indigo-400' : ''
                }`}
                title="Histórico de Conversas"
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleStartNewChat}
                className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
                title="Nova Conversa"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        {/* History Overlay Dropdown or Messages Area */}
        {showHistory ? (
          <div className="flex-1 flex flex-col min-h-0 bg-slate-950/90 p-4">
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-indigo-400" />
                Histórico de Conversas
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleStartNewChat}
                className="h-7 text-xs border-slate-700 bg-slate-800 text-slate-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-500"
              >
                <Plus className="h-3 w-3 mr-1" />
                Nova
              </Button>
            </div>

            <ScrollArea className="flex-1 pr-2">
              {conversations.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  Nenhuma conversa anterior encontrada.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {conversations.map((conv) => {
                    const isCurrent = conv.id === conversationId
                    const dateStr = conv.updated || conv.created
                    const formattedDate = dateStr
                      ? new Date(dateStr).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : ''

                    return (
                      <button
                        key={conv.id}
                        type="button"
                        onClick={() => loadConversationMessages(conv.id)}
                        className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors flex items-start justify-between gap-2 border ${
                          isCurrent
                            ? 'bg-indigo-950/60 border-indigo-500/50 text-white'
                            : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate text-slate-200">
                            {conv.title || `Conversa ${conv.id.slice(-6)}`}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{formattedDate}</p>
                        </div>
                        {isCurrent && (
                          <Badge className="bg-indigo-600 text-white text-[9px] px-1 py-0 h-3.5">
                            Atual
                          </Badge>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 bg-slate-900/60 relative">
            <ScrollArea className="flex-1 p-4">
              {messages.length === 0 ? (
                <div className="py-8 px-2 flex flex-col items-center justify-center text-center">
                  <div className="h-14 w-14 rounded-2xl bg-indigo-950/80 border border-indigo-800/50 flex items-center justify-center text-indigo-400 mb-4 shadow-inner">
                    <Sparkles className="h-7 w-7 text-indigo-400 animate-pulse" />
                  </div>
                  <h3 className="font-semibold text-white text-base mb-1">
                    Como posso te ajudar hoje?
                  </h3>
                  <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
                    Sou a <strong>Laika</strong>, sua assistente com IA integrada ao sistema PMais
                    RH. Posso responder dúvidas sobre processos, vagas, candidatos, requisições e
                    políticas internas.
                  </p>

                  <div className="w-full max-w-md space-y-2 text-left">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider px-1">
                      Perguntas sugeridas:
                    </p>
                    {suggestedQuestions.map((sug, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setInput(sug)
                          setTimeout(() => {
                            inputRef.current?.focus()
                          }, 50)
                        }}
                        className="w-full p-2.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-xs text-slate-300 hover:text-white border border-slate-750 transition-colors text-left flex items-center justify-between group"
                      >
                        <span className="truncate pr-2">{sug}</span>
                        <Send className="h-3 w-3 text-slate-500 group-hover:text-indigo-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pb-2">
                  {messages.map((msg) => {
                    const isUser = msg.role === 'user'

                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                      >
                        {!isUser && (
                          <Avatar className="h-7 w-7 bg-indigo-900 border border-indigo-700/60 text-white shrink-0 mt-0.5">
                            <AvatarFallback className="bg-indigo-800 text-indigo-200 text-xs">
                              <Bot className="h-3.5 w-3.5" />
                            </AvatarFallback>
                          </Avatar>
                        )}

                        <div
                          className={`flex flex-col max-w-[85%] sm:max-w-[80%] ${
                            isUser ? 'items-end' : 'items-start'
                          }`}
                        >
                          <div
                            className={`rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
                              isUser
                                ? 'bg-indigo-600 text-white rounded-br-xs font-normal'
                                : 'bg-slate-800/90 text-slate-200 border border-slate-700/60 rounded-bl-xs'
                            }`}
                          >
                            {msg.content || (
                              <span className="flex items-center space-x-1.5 text-slate-400 italic">
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                                <span>Digitando...</span>
                              </span>
                            )}
                          </div>

                          {/* Citations / sources */}
                          {!isUser && msg.citations && msg.citations.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5 pt-1">
                              {msg.citations.map((c, idx) => (
                                <Badge
                                  key={idx}
                                  variant="secondary"
                                  className="bg-slate-800 text-slate-400 border border-slate-700 text-[10px] px-2 py-0.5 flex items-center gap-1 font-normal"
                                  title={c.excerpt}
                                >
                                  <BookOpen className="h-2.5 w-2.5 text-indigo-400" />
                                  <span>Fonte [{c.n || idx + 1}]</span>
                                </Badge>
                              ))}
                            </div>
                          )}

                          <span className="text-[10px] text-slate-500 mt-1 px-1">
                            {msg.created
                              ? new Date(msg.created).toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : ''}
                          </span>
                        </div>

                        {isUser && (
                          <Avatar className="h-7 w-7 bg-slate-800 border border-slate-700 text-slate-300 shrink-0 mt-0.5">
                            <AvatarFallback className="bg-slate-850 text-slate-300 text-xs">
                              <User className="h-3.5 w-3.5" />
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    )
                  })}

                  {/* Visual typing indicator when assistant has an active stream but content is empty */}
                  {isStreaming &&
                    messages.length > 0 &&
                    messages[messages.length - 1]?.role === 'assistant' &&
                    !messages[messages.length - 1]?.content && (
                      <div className="flex items-center space-x-2 text-indigo-400 text-xs px-2 py-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-bounce" />
                        <span
                          className="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-bounce"
                          style={{ animationDelay: '0.2s' }}
                        />
                        <span
                          className="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-bounce"
                          style={{ animationDelay: '0.4s' }}
                        />
                        <span className="text-slate-400 text-[11px] ml-1">
                          Laika está pensando...
                        </span>
                      </div>
                    )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Error banner */}
            {error && (
              <div className="px-4 py-2 bg-rose-950/80 border-t border-rose-800/60 text-rose-300 text-xs flex items-center justify-between">
                <div className="flex items-center space-x-2 min-w-0">
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                  <span className="truncate">{error}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setError(null)}
                  className="h-6 px-2 text-[11px] text-rose-300 hover:text-white hover:bg-rose-900/60"
                >
                  Fechar
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Input Footer */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950 shrink-0">
          <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua pergunta para a Laika..."
              disabled={isLoading || isStreaming}
              className="flex-1 bg-slate-900 border-slate-750 text-slate-100 placeholder:text-slate-500 focus-visible:ring-indigo-500 text-xs sm:text-sm h-10"
            />
            {isStreaming ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  if (abortControllerRef.current) {
                    abortControllerRef.current.abort()
                    abortControllerRef.current = null
                  }
                  setIsStreaming(false)
                }}
                className="h-10 w-10 border-slate-700 bg-slate-800 text-rose-400 hover:bg-rose-950 hover:text-rose-300 shrink-0"
                title="Parar resposta"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="h-10 w-10 p-0 bg-indigo-600 hover:bg-indigo-500 text-white shrink-0 disabled:opacity-40"
                title="Enviar mensagem"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </form>
          <div className="flex items-center justify-between mt-2 px-1 text-[10px] text-slate-500">
            <span>Laika pode cometer erros. Verifique informações importantes.</span>
            {conversationId && (
              <span className="text-slate-600 font-mono">ID: {conversationId.slice(0, 8)}</span>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
