import { Board } from '@/components/Board'

export default function Home() {
  return (
    <main className="min-h-screen bg-[#032147]">
      <header className="h-16 px-6 flex items-center border-b border-white/10">
        <h1 className="text-lg font-bold text-white tracking-wider uppercase">Kanban</h1>
        <span className="ml-3 text-xs text-white/40 font-medium">Project Board</span>
      </header>
      <Board />
    </main>
  )
}
