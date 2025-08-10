"use client"
import { useEffect, useState } from 'react'
import { shellRun, fsCreate, fsMkdir, fsDelete, fsMove, fsSearch, fsRead, runTests } from '@/lib/api'
import { useStudio } from '@/lib/store'
import { toast } from 'sonner'

export default function RightRail() {
  const setFile = useStudio(s => s.setFile)
  const [status, setStatus] = useState<string>('')
  const [branch, setBranch] = useState<string>('')
  const [running, setRunning] = useState<boolean>(false)
  const [testOut, setTestOut] = useState<string>('')
  const [diff, setDiff] = useState<string>('')
  const [newFile, setNewFile] = useState('')
  const [newFolder, setNewFolder] = useState('')
  const [rmPath, setRmPath] = useState('')
  const [mvSrc, setMvSrc] = useState('')
  const [mvDst, setMvDst] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ path: string; line: number; text: string }[]>([])

  useEffect(() => {
    refreshGit()
  }, [])

  async function refreshGit() {
    try {
      const s = await shellRun(['git', 'status', '--short', '--branch'])
      setStatus(s.stdout.trim() || (s.ok ? '(clean)' : '(not a git repo)'))
      const b = await shellRun(['git', 'rev-parse', '--abbrev-ref', 'HEAD'])
      setBranch(b.stdout.trim() || (b.ok ? '' : 'no-branch'))
    } catch {
      setStatus('git not available or repository not initialized')
      setBranch('')
    }
  }

  async function quickStageCommit() {
    setRunning(true)
    try {
      const add = await shellRun(['git', 'add', '-A'])
      const commit = await shellRun(['git', 'commit', '-m', 'WIP'])
      if (!add.ok || !commit.ok) {
        setStatus(`${add.stdout}\n${commit.stdout}`.trim())
      }
      await refreshGit()
    } catch (e) {
      // ignore
    } finally {
      setRunning(false)
    }
  }
  async function showDiff() {
    setRunning(true)
    try {
      const out = await shellRun(['git', 'diff'])
      setDiff(out.stdout || '(no changes)')
    } catch {
      setDiff('Failed to get diff')
    } finally {
      setRunning(false)
    }
  }

  return (
    <aside className="h-full border-l w-80 p-3 text-sm text-zinc-300 space-y-4">
      <div>
        <div className="font-semibold mb-2">Workspace</div>
        <div className="space-y-2">
          <div className="flex gap-2">
            <input className="flex-1 bg-zinc-900 rounded px-2 py-1" placeholder="new file path" value={newFile} onChange={(e) => setNewFile(e.target.value)} />
          <button className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50" disabled={!newFile || running} onClick={async () => { setRunning(true); try { await fsCreate(newFile, ''); toast.success(`Created ${newFile}`); setNewFile(''); } catch(e:any){ toast.error(e?.message ?? 'Create failed'); } finally { setRunning(false); } }}>Create</button>
          </div>
          <div className="flex gap-2">
            <input className="flex-1 bg-zinc-900 rounded px-2 py-1" placeholder="new folder path" value={newFolder} onChange={(e) => setNewFolder(e.target.value)} />
          <button className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50" disabled={!newFolder || running} onClick={async () => { setRunning(true); try { await fsMkdir(newFolder); toast.success(`Created folder ${newFolder}`); setNewFolder(''); } catch(e:any){ toast.error(e?.message ?? 'Mkdir failed'); } finally { setRunning(false); } }}>Mkdir</button>
          </div>
          <div className="flex gap-2">
            <input className="flex-1 bg-zinc-900 rounded px-2 py-1" placeholder="delete path (file or empty dir)" value={rmPath} onChange={(e) => setRmPath(e.target.value)} />
          <button className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50" disabled={!rmPath || running} onClick={async () => { setRunning(true); try { await fsDelete(rmPath); toast.success(`Deleted ${rmPath}`); setRmPath(''); } catch(e:any){ toast.error(e?.message ?? 'Delete failed'); } finally { setRunning(false); } }}>Delete</button>
          </div>
          <div className="flex gap-2">
            <input className="flex-1 bg-zinc-900 rounded px-2 py-1" placeholder="move from" value={mvSrc} onChange={(e) => setMvSrc(e.target.value)} />
            <input className="flex-1 bg-zinc-900 rounded px-2 py-1" placeholder="to" value={mvDst} onChange={(e) => setMvDst(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50" disabled={!mvSrc || !mvDst || running} onClick={async () => { setRunning(true); try { await fsMove(mvSrc, mvDst); toast.success(`Moved to ${mvDst}`); setMvSrc(''); setMvDst(''); } catch(e:any){ toast.error(e?.message ?? 'Move failed'); } finally { setRunning(false); } }}>Move/Rename</button>
          </div>
        </div>
      </div>
      <div>
        <div className="font-semibold mb-2">Git</div>
        <div className="text-xs text-zinc-400">Branch</div>
        <div className="mb-2">{branch || 'unknown'}</div>
        <pre className="bg-zinc-900/50 rounded p-2 max-h-40 overflow-auto whitespace-pre-wrap">{status}</pre>
        <div className="mt-2 flex gap-2">
          <button className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50" disabled={running} onClick={refreshGit}>
            Refresh
          </button>
          <button className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50" disabled={running} onClick={quickStageCommit}>
            Quick commit
          </button>
        </div>
        <div className="mt-2 flex gap-2">
          <button className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50" disabled={running} onClick={showDiff}>
            Show diff
          </button>
        </div>
        {diff && (
          <pre className="bg-zinc-900/50 rounded p-2 max-h-64 overflow-auto whitespace-pre-wrap mt-2">{diff}</pre>
        )}
      </div>
      <div>
        <div className="font-semibold mb-2">Search</div>
        <div className="flex gap-2 mb-2">
          <input className="flex-1 bg-zinc-900 rounded px-2 py-1" placeholder="query text" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50" disabled={!query || running} onClick={async () => { setRunning(true); try { const r = await fsSearch(query); setResults(r); } finally { setRunning(false); } }}>Find</button>
        </div>
        <div className="space-y-1 max-h-64 overflow-auto">
          {results.map((m, i) => (
            <button
              key={`${m.path}:${m.line}:${i}`}
              className="w-full text-left rounded bg-zinc-900/50 px-2 py-1 hover:bg-zinc-800/70"
              onClick={async () => {
                const content = await fsRead(m.path)
                setFile(m.path, content)
              }}
            >
              <div className="text-xs text-zinc-500">{m.path}:{m.line}</div>
              <div className="truncate">{m.text}</div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="font-semibold mb-2">Tests</div>
        <div className="flex gap-2 mb-2">
          <button className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50" disabled={running} onClick={async () => { setRunning(true); setTestOut(''); try { const res = await runTests(); setTestOut(res.stdout); res.ok ? toast.success('Tests passed') : toast.error('Tests failed'); } catch { toast.error('Failed to run tests'); } finally { setRunning(false); } }}>
            Run tests
          </button>
        </div>
        <pre className="bg-zinc-900/50 rounded p-2 max-h-64 overflow-auto whitespace-pre-wrap">{testOut}</pre>
      </div>
    </aside>
  )
}
