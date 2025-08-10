import '../styles/globals.css'
import 'xterm/css/xterm.css'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Codex Studio', description: 'Mini‑IDE for agent coding' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-zinc-200">{children}</body>
    </html>
  )
}
