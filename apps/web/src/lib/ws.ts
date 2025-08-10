export function connectWS(sessionId: string) {
  const url = `ws://localhost:5050/ws/session/${sessionId}`
  return new WebSocket(url)
}

