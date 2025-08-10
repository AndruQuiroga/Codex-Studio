export async function health(): Promise<{ ok: boolean }> {
  const res = await fetch('http://localhost:5050/health', { cache: 'no-store' })
  if (!res.ok) throw new Error('Health check failed')
  return res.json()
}

