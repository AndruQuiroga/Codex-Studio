'use client'
import clsx from 'clsx'
import { X } from 'lucide-react'
import { useStudio } from '@/lib/store'

export default function Tabs() {
  const open = useStudio(s => s.open)
  const active = useStudio(s => s.filePath)
  const closeFile = useStudio(s => s.closeFile)
  const setActive = useStudio(s => s.setActive)

  if (open.length === 0) return null

  return (
    <div className="flex border-b border-zinc-800 bg-zinc-950/40 text-xs overflow-x-auto select-none">
      {open.map(path => {
        const name = path.split('/').pop() || path
        const isActive = path === active
        return (
          <div
            key={path}
            className={clsx(
              'group flex items-center gap-2 px-3 py-1 cursor-pointer border-r border-zinc-800',
              isActive ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800/60'
            )}
            onClick={() => setActive(path)}
            title={path}
          >
            <span className="truncate max-w-[10rem]">{name}</span>
            <button
              className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-zinc-300"
              onClick={e => {
                e.stopPropagation()
                closeFile(path)
              }}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
