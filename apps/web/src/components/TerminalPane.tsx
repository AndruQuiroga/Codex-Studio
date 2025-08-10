"use client"
import { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { API_BASE, terminalWSUrl } from '@/lib/ws'
import { toast } from 'sonner'

export default function TerminalPane() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    const term = new Terminal({
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 12,
      theme: { background: '#000000', foreground: '#e4e4e7' },
      cursorBlink: true,
      allowProposedApi: true,
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    termRef.current = term
    fitRef.current = fit
    if (containerRef.current) {
      term.open(containerRef.current)
      fit.fit()
    }

    const mkSocket = () => new WebSocket(terminalWSUrl())
    let reconnectTimer: any = null
    let ws: WebSocket | null = null
    function openSocket() {
      const socket = mkSocket()
      ;(socket as any)._reconnect = () => {
        if (reconnectTimer) return
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null
          connect()
        }, 1500)
      }
      socket.onopen = () => {
        // kick a prompt and send initial size
        socket.send(JSON.stringify({ type: 'input', data: '\\n' }))
        try {
          socket.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
        } catch {}
        toast.success('Terminal connected')
      }
      socket.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data)
          if (msg.type === 'output' && typeof msg.data === 'string') {
            term.write(msg.data)
          }
        } catch {
          term.write(ev.data)
        }
      }
      socket.onclose = () => {
        term.write('\r\n[terminal] disconnected — retrying...\r\n')
        ;(socket as any)._reconnect()
        toast.error('Terminal disconnected — retrying...')
      }
      term.onData((d) => {
        socket.readyState === WebSocket.OPEN && socket.send(JSON.stringify({ type: 'input', data: d }))
      })
      // Handle resize events
      term.onResize((size) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'resize', cols: size.cols, rows: size.rows }))
        }
        fit.fit()
      })
      return socket
    }

    async function connect() {
      const base = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE
      try {
        const res = await fetch(`${base}/health`)
        if (!res.ok) throw new Error('health check failed')
        ws = openSocket()
      } catch {
        term.write('\r\n[terminal] backend unavailable — retrying...\r\n')
        toast.error('Terminal backend unavailable — retrying...')
        if (reconnectTimer) return
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null
          connect()
        }, 1500)
      }
    }

    connect()

    const onResize = () => fit.fit()
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      if (reconnectTimer) clearTimeout(reconnectTimer)
      ws?.close()
      term.dispose()
    }
  }, [])

  return <div ref={containerRef} className="h-full bg-black" />
}
