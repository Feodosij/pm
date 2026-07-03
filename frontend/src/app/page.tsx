'use client'
import { useEffect, useState } from 'react'
import { Board } from '@/components/Board'
import { ChatSidebar } from '@/components/ChatSidebar'
import { Login } from '@/components/Login'
import { fetchMe, logout } from '@/lib/api'

type AuthState = 'loading' | 'unauthenticated' | 'authenticated'

export default function Home() {
  const [auth, setAuth] = useState<AuthState>('loading')
  const [chatOpen, setChatOpen] = useState(false)
  const [boardReloadKey, setBoardReloadKey] = useState(0)

  useEffect(() => {
    fetchMe().then(data =>
      setAuth(data.authenticated ? 'authenticated' : 'unauthenticated')
    )
  }, [])

  if (auth === 'loading') {
    return (
      <main className="min-h-screen bg-[#032147] flex items-center justify-center">
        <p className="text-white/60 text-sm">Loading…</p>
      </main>
    )
  }

  if (auth === 'unauthenticated') {
    return <Login onSuccess={() => setAuth('authenticated')} />
  }

  async function handleLogout() {
    await logout()
    setAuth('unauthenticated')
    setChatOpen(false)
  }

  function handleBoardUpdate() {
    setBoardReloadKey(k => k + 1)
  }

  return (
    <main className="min-h-screen bg-[#032147]">
      <header className="h-16 px-6 flex items-center border-b border-white/10">
        <h1 className="text-lg font-bold text-white tracking-wider uppercase">Kanban</h1>
        <span className="ml-3 text-xs text-white/40 font-medium">Project Board</span>
        <div className="ml-auto flex items-center gap-4">
          <button
            onClick={() => setChatOpen(open => !open)}
            aria-label="Toggle AI chat"
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
              chatOpen
                ? 'bg-[#209dd7] text-white'
                : 'text-white/60 hover:text-white bg-white/5 hover:bg-white/10'
            }`}
          >
            <span>AI</span>
            <span className={`text-[10px] transition-transform ${chatOpen ? 'rotate-180' : ''}`}>▲</span>
          </button>
          <button
            onClick={handleLogout}
            className="text-xs text-white/60 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-64px)]">
        <div className="flex-1 overflow-x-auto">
          <Board reloadKey={boardReloadKey} />
        </div>
        {chatOpen && <ChatSidebar onBoardUpdate={handleBoardUpdate} />}
      </div>
    </main>
  )
}
