'use client'
import { useEffect, useMemo, useState } from 'react'
import Fuse from 'fuse.js'
import { fsTree, fsRead } from '@/lib/api'
import { useStudio } from '@/lib/store'

export default function QuickOpen() {
  const open = useStudio(s => s.quickOpen)
  const setQuickOpen = useStudio(s => s.setQuickOpen)
  const setFile = useStudio(s => s.setFile)
  const [files, setFiles] = useState<string[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (open && files.length === 0) {
      fsTree('').then(setFiles).catch(() => setFiles([]))
    }
  }, [open, files.length])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setQuickOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setQuickOpen])

  const fuse = useMemo(() => new Fuse(files, { includeScore: true }), [files])
  const results = query ? fuse.search(query).slice(0, 50).map(r => r.item) : files.slice(0, 50)

  async function openFile(path: string) {
    const content = await fsRead(path)
    setFile(path, content)
    setQuickOpen(false)
    setQuery('')
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 z-50">
      <div className="w-full max-w-lg bg-zinc-900 rounded shadow-lg overflow-hidden text-sm">
        <input
          className="w-full p-2 bg-zinc-800 text-zinc-100 outline-none border-b border-zinc-700"
          autoFocus
          placeholder="Search files..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <div className="max-h-80 overflow-auto">
          {results.map((p) => (
            <div
              key={p}
              className="px-2 py-1 hover:bg-zinc-700 cursor-pointer truncate"
              onClick={() => openFile(p)}
            >
              {p}
            </div>
          ))}
          {results.length === 0 && (
            <div className="px-2 py-1 text-zinc-500">No matches</div>
          )}
        </div>
      </div>
    </div>
  )
}
