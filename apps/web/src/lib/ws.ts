export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:5050'

function toWsUrl(httpUrl: string): string {
  try {
    const u = new URL(httpUrl)
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
    return u.toString()
  } catch {
    // Fallback if env is a bare host:port
    const pref = httpUrl.startsWith('https') ? 'wss://' : 'ws://'
    return httpUrl.startsWith('http') ? httpUrl.replace(/^http/, 'ws') : `${pref}${httpUrl}`
  }
}

export function connectWS(sessionId: string) {
  const base = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE
  const url = toWsUrl(`${base}/ws/session/${sessionId}`)
  return new WebSocket(url)
}

export function terminalWSUrl() {
  const base = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE
  return toWsUrl(`${base}/ws/terminal`)
}
