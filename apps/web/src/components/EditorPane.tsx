'use client'
import Editor from '@monaco-editor/react'
import { useState } from 'react'

export default function EditorPane() {
  const [code, setCode] = useState('// start typing\n')
  return (
    <Editor height="100%" defaultLanguage="typescript" value={code} onChange={(v) => setCode(v || '')} />
  )
}

