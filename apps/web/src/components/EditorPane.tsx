'use client'
import Editor from '@monaco-editor/react'
import { useState, useEffect } from 'react'
import { useStudio } from '@/lib/store'
import { fsWrite } from '@/lib/api'

export default function EditorPane() {
  const filePath = useStudio(s => s.filePath)
  const code = useStudio(s => s.code)
  const setCode = useStudio(s => s.setCode)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // future: language by extension
  }, [filePath])

  async function save() {
    if (!filePath) return
    setSaving(true)
    try {
      await fsWrite(filePath, code)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full relative">
      <div className="absolute right-2 top-2 z-10 flex gap-2">
        <span className="text-xs text-zinc-500">{filePath ?? 'untitled'}</span>
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
        defaultLanguage="typescript"
        value={code}
        onChange={(v) => setCode(v || '')}
        options={{ fontSize: 14, minimap: { enabled: false } }}
      />
    </div>
  )
}
