'use client'
import { useEffect, useState } from 'react'
import { fsList, fsRead, type FsItem } from '@/lib/api'
import { useStudio } from '@/lib/store'

type Node = FsItem & { open?: boolean; children?: Node[] }

async function ensureChildren(n: Node): Promise<Node> {
  if (!n.dir) return n
  if (n.children) return n
  const kids = await fsList(n.path)
  return { ...n, children: kids.map(k => ({ ...k })) }
}

export default function Sidebar() {
  const setFile = useStudio(s => s.setFile)
  const [root, setRoot] = useState<Node | null>(null)

  useEffect(() => {
    refresh()
  }, [])

  function refresh() {
    fsList('')
      .then(items => setRoot({ name: '.', path: '', dir: true, open: true, children: items }))
      .catch(() => setRoot({ name: '.', path: '', dir: true, open: true, children: [] }))
  }

  async function toggle(node: Node) {
    if (!node.dir) return
    const hydrated = await ensureChildren(node)
    node.open = !node.open
    node.children = hydrated.children
    setRoot(r => (r ? { ...r } : r))
  }

  async function openFile(node: Node) {
    if (node.dir) return
    const content = await fsRead(node.path)
    setFile(node.path, content)
  }

  function Row({ node, depth = 0 }: { node: Node; depth?: number }) {
    return (
      <div className="select-none">
        <div
          className="flex items-center gap-2 py-1 px-2 rounded hover:bg-zinc-800/50 cursor-pointer"
          style={{ paddingLeft: 8 + depth * 12 }}
          onClick={() => (node.dir ? toggle(node) : openFile(node))}
          title={node.path || '/'}
        >
          {node.dir ? <span>{node.open ? '📂' : '📁'}</span> : <span>📄</span>}
          <span className="truncate">{node.name}</span>
        </div>
        {node.dir && node.open && node.children?.map((c) => <Row key={c.path} node={c} depth={depth + 1} />)}
      </div>
    )
  }

  return (
    <aside className="h-full border-r w-56 text-sm text-zinc-300 flex flex-col">
      <div className="p-2 border-b flex items-center justify-between">
        <div className="font-semibold text-xs">Files</div>
        <button className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs" onClick={refresh}>
          Refresh
        </button>
      </div>
      <div className="flex-1 overflow-auto p-2">
        {!root ? <div className="p-2 text-zinc-500">Loading…</div> : <Row node={root} />}
      </div>
    </aside>
  )
}
