'use client'
import { useEffect, useRef, useState } from 'react'
import { connectWS } from '@/lib/ws'
import { motion } from 'framer-motion'
import Markdown from '@/components/Markdown'
import { toast } from 'sonner'

type Msg = { role: 'user' | 'assistant'; text: string }

export default function Chat() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const wsRef = useRef<WebSocket | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const sessionId = 'local'

  useEffect(() => {
    let timer: any = null
    const open = () => {
      const ws = connectWS(sessionId)
      wsRef.current = ws
      ws.onmessage = (ev) => {
        const data = JSON.parse(ev.data)
        if (data.type === 'partial') {
          setMessages((m) => {
            const next = [...m]
            const last = next[next.length - 1]
            if (last && last.role === 'assistant') {
              next[next.length - 1] = { ...last, text: (last.text || '') + (data.payload.text || '') }
            }
            return next
          })
        } else if (data.type === 'final') {
          // noop
        } else if (data.type === 'tool_request') {
          setMessages((m) => [...m, { role: 'assistant', text: `Tool requested: ${data.payload?.tool ?? 'unknown'}` }])
        } else if (data.type === 'tool_result') {
          setMessages((m) => [...m, { role: 'assistant', text: `Tool result:\n${data.payload?.text ?? ''}` }])
        } else if (data.type === 'error') {
          setMessages((m) => [...m, { role: 'assistant', text: `Error: ${data.payload?.message ?? 'unknown'}` }])
        }
        // Scroll to bottom on new output
        requestAnimationFrame(() => {
          const c = listRef.current
          if (c) c.scrollTop = c.scrollHeight
        })
      }
      ws.onclose = () => {
        toast.error('Chat disconnected — retrying...')
        timer = setTimeout(open, 1500)
      }
      ws.onopen = () => {
        toast.success('Chat connected')
      }
    }
    open()
    return () => {
      timer && clearTimeout(timer)
      wsRef.current?.close()
    }
  }, [])

  function sendPrompt() {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    if (!input.trim()) return
    setMessages((m) => [...m, { role: 'user', text: input }, { role: 'assistant', text: '' }])
    ws.send(
      JSON.stringify({ type: 'user', payload: { text: input }, messageId: crypto.randomUUID() })
    )
    setInput('')
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={listRef} className="flex-1 overflow-auto space-y-3 p-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <motion.div
              className={`max-w-[80%] whitespace-pre-wrap rounded-2xl p-3 ${m.role === 'user' ? 'bg-zinc-800 text-zinc-100' : 'bg-zinc-900/60 border border-zinc-800'}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {m.role === 'assistant' ? <Markdown text={m.text} /> : <pre className="whitespace-pre-wrap">{m.text}</pre>}
            </motion.div>
          </div>
        ))}
      </div>
      <div className="p-3 border-t bg-zinc-950/50 flex gap-2">
        <textarea
          className="flex-1 bg-zinc-900 rounded-xl px-3 py-2 outline-none min-h-[2.5rem] max-h-32"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              sendPrompt()
            }
          }}
          placeholder="Ask the agent… (Shift+Enter for newline)"
        />
        <button className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50" disabled={!input.trim()} onClick={sendPrompt}>
          Send
        </button>
      </div>
    </div>
  )
}
