export const API = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:5050'

export type FsItem = { name: string; path: string; dir: boolean }

export async function fsList(path = ''): Promise<FsItem[]> {
  const res = await fetch(`${API}/api/fs/list?path=${encodeURIComponent(path)}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('fsList failed')
  return res.json()
}

export async function fsRead(path: string): Promise<string> {
  const res = await fetch(`${API}/api/fs/read?path=${encodeURIComponent(path)}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('fsRead failed')
  const data = await res.json()
  return data.content as string
}

export async function fsWrite(path: string, content: string): Promise<void> {
  const res = await fetch(`${API}/api/fs/write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  })
  if (!res.ok) throw new Error('fsWrite failed')
}

export async function fsMkdir(path: string): Promise<void> {
  const res = await fetch(`${API}/api/fs/mkdir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  if (!res.ok) throw new Error('fsMkdir failed')
}

export async function fsCreate(path: string, content = ''): Promise<void> {
  const res = await fetch(`${API}/api/fs/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  })
  if (!res.ok) throw new Error('fsCreate failed')
}

export async function fsDelete(path: string): Promise<void> {
  const res = await fetch(`${API}/api/fs/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  if (!res.ok) throw new Error('fsDelete failed')
}

export async function fsMove(src: string, dst: string): Promise<void> {
  const res = await fetch(`${API}/api/fs/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ src, dst }),
  })
  if (!res.ok) throw new Error('fsMove failed')
}

export async function fsSearch(q: string, path = ''): Promise<{ path: string; line: number; text: string }[]> {
  const res = await fetch(`${API}/api/search?q=${encodeURIComponent(q)}&path=${encodeURIComponent(path)}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('fsSearch failed')
  return res.json()
}

export async function fsTree(path = ''): Promise<string[]> {
  const res = await fetch(`${API}/api/fs/tree?path=${encodeURIComponent(path)}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('fsTree failed')
  return res.json()
}

export async function formatPython(code: string, lineLength = 100): Promise<string> {
  const res = await fetch(`${API}/api/format/python`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, line_length: lineLength }),
  })
  if (!res.ok) throw new Error('formatPython failed')
  const data = await res.json()
  return data.code as string
}

export async function runTests(): Promise<{ ok: boolean; code: number; stdout: string }> {
  const res = await fetch(`${API}/api/tests/run`, { method: 'POST' })
  if (!res.ok) throw new Error('runTests failed')
  return res.json()
}

export async function shellRun(cmd: string[], cwd = ''): Promise<{ stdout: string; ok: boolean; code: number }> {
  const res = await fetch(`${API}/api/shell/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd, cwd }),
  })
  if (!res.ok) throw new Error('shellRun failed')
  return res.json()
}
