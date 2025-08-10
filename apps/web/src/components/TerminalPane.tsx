"use client"
import { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'

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

    const ws = new WebSocket('ws://localhost:5050/ws/terminal')
    ws.onopen = () => {
      // kick a prompt
      ws.send(JSON.stringify({ type: 'input', data: '\n' }))
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
    term.onData((d) => {
      ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: 'input', data: d }))
    })

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
