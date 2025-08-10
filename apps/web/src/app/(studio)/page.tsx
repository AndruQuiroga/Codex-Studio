import Topbar from '@/components/Topbar'
import Sidebar from '@/components/Sidebar'
import Chat from '@/components/Chat'
import TerminalPane from '@/components/TerminalPane'
import RightRail from '@/components/RightRail'

export default function Studio() {
  return (
    <div className="h-screen grid grid-rows-[3rem_1fr]">
      <Topbar />
      <div className="grid grid-cols-[14rem_1fr_20rem]">
        <Sidebar />
        <main className="grid grid-rows-[1fr_1fr]">
          <section className="border-b overflow-hidden">
            <Chat />
          </section>
          <section className="overflow-hidden">
            <TerminalPane />
          </section>
        </main>
        <RightRail />
      </div>
    </div>
  )
}
