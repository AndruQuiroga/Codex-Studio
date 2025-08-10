"use client"
import { useEffect } from 'react'
import Topbar from '@/components/Topbar'
import Sidebar from '@/components/Sidebar'
import Chat from '@/components/Chat'
import dynamic from 'next/dynamic'
import RightRail from '@/components/RightRail'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import Tabs from '@/components/Tabs'
import QuickOpen from '@/components/QuickOpen'

const EditorPane = dynamic(() => import('@/components/EditorPane'), { ssr: false })
const TerminalPane = dynamic(() => import('@/components/TerminalPane'), { ssr: false })
import { useStudio } from '@/lib/store'

export default function Studio() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        const { quickOpen, setQuickOpen } = useStudio.getState()
        setQuickOpen(!quickOpen)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="h-screen grid grid-rows-[3rem_1fr]">
      <Topbar />
      <PanelGroup direction="horizontal" className="h-full" autoSaveId="studio-h">
        <Panel defaultSize={18} minSize={12} className="border-r overflow-hidden">
          <Sidebar />
        </Panel>
        <PanelResizeHandle className="w-1 bg-zinc-900 hover:bg-zinc-800 cursor-col-resize" />
        <Panel>
          <PanelGroup direction="vertical" className="h-full" autoSaveId="studio-v">
            <Panel defaultSize={34} minSize={20} className="border-b overflow-hidden">
              <Chat />
            </Panel>
            <PanelResizeHandle className="h-1 bg-zinc-900 hover:bg-zinc-800 cursor-row-resize" />
            <Panel defaultSize={33} minSize={20} className="border-b overflow-hidden">
              <div className="flex flex-col h-full">
                <Tabs />
                <div className="flex-1">
                  <EditorPane />
                </div>
              </div>
            </Panel>
            <PanelResizeHandle className="h-1 bg-zinc-900 hover:bg-zinc-800 cursor-row-resize" />
            <Panel defaultSize={33} minSize={15} className="overflow-hidden">
              <TerminalPane />
            </Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle className="w-1 bg-zinc-900 hover:bg-zinc-800 cursor-col-resize" />
        <Panel defaultSize={22} minSize={16} className="border-l overflow-hidden">
          <RightRail />
        </Panel>
      </PanelGroup>
      <QuickOpen />
    </div>
  )
}
