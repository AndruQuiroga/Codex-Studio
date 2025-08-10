'use client'
import { useEffect, useRef, useState } from 'react'
import { connectWS } from '@/lib/ws'
import { motion } from 'framer-motion'

export default function Chat() {
  const [messages, setMessages] = useState<string[]>([])
  const [input, setInput] = useState('')
  const wsRef = useRef<WebSocket | null>(null)
  const sessionId = 'local'

  useEffect(() => {
    const ws = connectWS(sessionId)
    wsRef.current = ws
    ws.onmessage = (ev) => {
      const data = JSON.parse(ev.data)
      if (data.type === 'partial') {
        setMessages((m) => [...m.slice(0, -1), (m[m.length - 1] || '') + data.payload.text])
      } else if (data.type === 'final') {
        // noop, message already formed
      }
    }
    return () => {
      ws.close()
    }
  }, [])

  function sendPrompt() {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    setMessages((m) => [...m, ''])
    ws.send(
      JSON.stringify({ type: 'user', payload: { text: input }, messageId: crypto.randomUUID() })
    )
    setInput('')
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto space-y-3 p-3">
        {messages.map((m, i) => (
          <motion.pre
            key={i}
            className="whitespace-pre-wrap bg-zinc-900/50 rounded-xl p-3"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {m}
          </motion.pre>
        ))}
      </div>
      <div className="p-3 border-t bg-zinc-950/50 flex gap-2">
        <input
          className="flex-1 bg-zinc-900 rounded-xl px-3 py-2 outline-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the agent…"
        />
        <button className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700" onClick={sendPrompt}>
          Send
        </button>
      </div>
    </div>
  )
}

