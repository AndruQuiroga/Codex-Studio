const API = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:5050'

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
