'use client'
import Editor from '@monaco-editor/react'
import { useState, useEffect, useMemo } from 'react'
import { useStudio } from '@/lib/store'
import { fsWrite, formatPython } from '@/lib/api'
import { formatWithPrettier, type SupportedLang } from '@/lib/format'
import { toast } from 'sonner'

export default function EditorPane() {
  const filePath = useStudio(s => s.filePath)
  const code = useStudio(s => s.code)
  const setCode = useStudio(s => s.setCode)
  const markSaved = useStudio(s => s.markSaved)
  const isDirty = useStudio(s => (s.filePath ? !!s.dirty[s.filePath] : false))
  const [saving, setSaving] = useState(false)
  const [formatting, setFormatting] = useState(false)

  const language = useMemo(() => {
    if (!filePath) return 'plaintext'
    const ext = filePath.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript'
      case 'js':
      case 'jsx':
        return 'javascript'
      case 'py':
        return 'python'
      case 'json':
        return 'json'
      case 'md':
        return 'markdown'
      case 'css':
        return 'css'
      case 'html':
        return 'html'
      case 'sh':
        return 'shell'
      default:
        return 'plaintext'
    }
  }, [filePath])

  useEffect(() => {
    // noop: dirty tracking via store baseline
  }, [filePath])

  async function save() {
    if (!filePath) return
    setSaving(true)
    try {
      await fsWrite(filePath, code)
      markSaved(filePath, code)
      toast.success(`Saved ${filePath}`)
    } finally {
      setSaving(false)
    }
  }

  async function formatIfPython() {
    if (language !== 'python') return
    setFormatting(true)
    try {
      const formatted = await formatPython(code)
      setCode(formatted)
      toast.success('Formatted with Black')
    } finally {
      setFormatting(false)
    }
  }

  async function formatWithPrettierIfSupported() {
    const map: Record<string, SupportedLang> = {
      javascript: 'javascript',
      typescript: 'typescript',
      json: 'json',
      markdown: 'markdown',
      css: 'css',
      html: 'html',
    }
    const lang = map[language]
    if (!lang) return
    setFormatting(true)
    try {
      const formatted = await formatWithPrettier(code, lang)
      setCode(formatted)
      toast.success('Formatted')
    } catch (e: any) {
      toast.error(`Format failed: ${e?.message ?? e}`)
    } finally {
      setFormatting(false)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save])

  return (
    <div className="h-full relative">
      <div className="absolute right-2 top-2 z-10 flex gap-2">
        <span className="text-xs text-zinc-500">{filePath ?? 'untitled'} {isDirty ? '•' : ''}</span>
        {language === 'python' && (
          <button
            className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs"
            disabled={formatting}
            onClick={formatIfPython}
            title="Format with Black"
          >
            {formatting ? 'Formatting…' : 'Format'}
          </button>
        )}
        {language !== 'python' && (
          <button
            className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs"
            disabled={formatting}
            onClick={formatWithPrettierIfSupported}
            title="Format with Prettier"
          >
            {formatting ? 'Formatting…' : 'Format'}
          </button>
        )}
        <button
          className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs"
          disabled={!filePath || saving}
          onClick={save}
          title={filePath ? `Save ${filePath}` : 'Open a file from the left'}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <Editor
        height="100%"
        defaultLanguage="plaintext"
        language={language as any}
        value={code}
        onChange={(v) => setCode(v || '')}
        options={{ fontSize: 14, minimap: { enabled: false } }}
      />
    </div>
  )
}
