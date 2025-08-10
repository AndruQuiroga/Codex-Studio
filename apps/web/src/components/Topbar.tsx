"use client"
import { useEffect, useState } from 'react'
import { API } from '@/lib/api'
import { Cpu, Circle } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import { useStudio } from '@/lib/store'

export default function Topbar() {
  const [ok, setOk] = useState<boolean | null>(null)
  const [codex, setCodex] = useState<boolean>(false)
  const setQuickOpen = useStudio(s => s.setQuickOpen)

  useEffect(() => {
    let mounted = true
    const tick = async () => {
      try {
        const res = await fetch(`${API}/health`, { cache: 'no-store' })
        const j = await res.json()
        if (!mounted) return
        setOk(Boolean(j.ok && j.projectRoot))
        setCodex(Boolean(j.codexConfigured))
      } catch {
        if (!mounted) return
        setOk(false)
        setCodex(false)
      }
    }
    tick()
    const id = setInterval(tick, 5000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  return (
    <div className="h-12 border-b bg-gradient-to-r from-zinc-950 to-zinc-900/80 backdrop-blur flex items-center px-4 text-zinc-200 gap-4">
      <div className="flex items-center gap-2">
        <Cpu className="w-4 h-4 text-zinc-400" />
        <div className="font-semibold">Codex Studio</div>
      </div>
      <div className="ml-2 text-xs text-zinc-400">single‑project • dark mode</div>
      <div className="ml-auto flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1" title="API health">
          <Circle className={`w-3 h-3 ${ok ? 'text-emerald-400' : ok === null ? 'text-zinc-500' : 'text-red-400'}`} />
          <span className="text-zinc-400">API</span>
        </div>
        <div className="flex items-center gap-1" title="Codex configured">
          <Circle className={`w-3 h-3 ${codex ? 'text-sky-400' : 'text-zinc-600'}`} />
          <span className="text-zinc-400">Codex</span>
        </div>
        <button className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700" onClick={() => setQuickOpen(true)} title="Quick Open (Ctrl/Cmd+P)">Quick Open</button>
        <ThemeToggle />
      </div>
    </div>
  )
}
