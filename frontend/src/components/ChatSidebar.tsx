'use client'
import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { apiChat } from '@/lib/api'
import type { ChatMessage } from '@/lib/types'

type Props = {
  onBoardUpdate: () => void
}

export function ChatSidebar({ onBoardUpdate }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' })
  }, [messages, loading])

  async function send() {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    const nextHistory = [...messages, userMsg]
    setMessages(nextHistory)
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const res = await apiChat(text, messages)
      const aiMsg: ChatMessage = { role: 'assistant', content: res.reply }
      setMessages(prev => [...prev, aiMsg])
      if (res.board_update && res.board_update.length > 0) {
        onBoardUpdate()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <aside
      data-testid="chat-sidebar"
      className="flex flex-col w-80 shrink-0 bg-[#021636] border-l border-white/10 min-h-[calc(100vh-64px)]"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <h2 className="text-sm font-semibold text-white/80 tracking-wide uppercase">AI Assistant</h2>
        <p className="text-xs text-white/30 mt-0.5">Manage your board with natural language</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <p className="text-white/25 text-xs text-center mt-8 leading-relaxed">
            Ask me to manage your board — move cards, create tasks, delete items, or give a summary.
          </p>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#209dd7] text-white rounded-br-sm'
                  : 'bg-white/10 text-white/90 rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/10 rounded-xl rounded-bl-sm px-3 py-2">
              <span className="text-white/40 text-xs">Thinking…</span>
            </div>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-lg bg-red-900/30 border border-red-500/30 px-3 py-2"
          >
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/10">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="Message AI…"
            rows={2}
            className="flex-1 resize-none bg-white/10 text-white text-sm placeholder-white/30 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-[#209dd7] disabled:opacity-50 leading-snug"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="px-3 py-2 bg-[#209dd7] text-white text-sm rounded-lg hover:bg-[#1a8cc0] active:bg-[#1577a0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            Send
          </button>
        </div>
      </div>
    </aside>
  )
}
