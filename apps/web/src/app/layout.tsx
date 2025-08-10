import './globals.css'
import 'xterm/css/xterm.css'
import 'highlight.js/styles/github-dark.min.css'
import type { Metadata } from 'next'
import { Toaster } from 'sonner'

export const metadata: Metadata = { title: 'Codex Studio', description: 'Mini‑IDE for agent coding' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-zinc-200">
        {children}
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  )
}
