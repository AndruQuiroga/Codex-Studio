import Link from 'next/link'

export default function Home() {
  return (
    <main className="p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Codex Studio</h1>
      <p className="text-zinc-400">Head to the Studio to start chatting & editing.</p>
      <Link className="underline" href="/studio">
        Open Studio
      </Link>
    </main>
  )
}

