"use client"
import { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { terminalWSUrl } from '@/lib/ws'
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
    const openSocket = () => {
      const ws = mkSocket()
      ;(ws as any)._reconnect = () => {
        if (reconnectTimer) return
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null
          openSocket()
        }, 1500)
      }
      ws.onopen = () => {
        // kick a prompt and send initial size
        ws.send(JSON.stringify({ type: 'input', data: '\\n' }))
        try {
          ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
        } catch {}
        toast.success('Terminal connected')
      }
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data)
          if (msg.type === 'output' && typeof msg.data === 'string') {
            term.write(msg.data)
          }
        } catch {
          term.write(ev.data)
        }
      }
      ws.onclose = () => {
        term.write('\r\n[terminal] disconnected — retrying...\r\n')
        ;(ws as any)._reconnect()
        toast.error('Terminal disconnected — retrying...')
      }
      term.onData((d) => {
        ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: 'input', data: d }))
      })
      // Handle resize events
      term.onResize((size) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols: size.cols, rows: size.rows }))
        }
        fit.fit()
      })
      return ws
    }
    const ws = openSocket()

    const onResize = () => fit.fit()
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      ws.close()
      term.dispose()
    }
  }, [])

  return <div ref={containerRef} className="h-full bg-black" />
}
