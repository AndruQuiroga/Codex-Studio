'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'
import { Check, Copy } from 'lucide-react'

export default function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      className="prose prose-invert max-w-none"
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        pre: Pre,
      }}
    >
      {text}
    </ReactMarkdown>
  )
}

function Pre({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) {
  const child: any = Array.isArray(children) ? children[0] : children
  const code = child?.props?.children ?? ''

  return (
    <pre {...props} className="relative">
      <CopyButton value={String(code)} />
      {children}
    </pre>
  )
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error('copy failed', err)
    }
  }

  return (
    <button
      onClick={onCopy}
      className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded bg-zinc-700 text-zinc-200 hover:bg-zinc-600"
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </button>
  )
}
