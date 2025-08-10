import Topbar from '@/components/Topbar'
import Sidebar from '@/components/Sidebar'
import Chat from '@/components/Chat'
import TerminalPane from '@/components/TerminalPane'
import RightRail from '@/components/RightRail'
import EditorPane from '@/components/EditorPane'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import Tabs from '@/components/Tabs'
import QuickOpen from '@/components/QuickOpen'

export default function Studio() {
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
              <Tabs />
              <EditorPane />
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
