'use client'
import { useEffect, useState } from 'react'
import { Board } from '@/components/Board'
import { Login } from '@/components/Login'
import { fetchMe, logout } from '@/lib/api'

type AuthState = 'loading' | 'unauthenticated' | 'authenticated'

export default function Home() {
  const [auth, setAuth] = useState<AuthState>('loading')

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
  }

  return (
    <main className="min-h-screen bg-[#032147]">
      <header className="h-16 px-6 flex items-center border-b border-white/10">
        <h1 className="text-lg font-bold text-white tracking-wider uppercase">Kanban</h1>
        <span className="ml-3 text-xs text-white/40 font-medium">Project Board</span>
        <button
          onClick={handleLogout}
          className="ml-auto text-xs text-white/60 hover:text-white transition-colors"
        >
          Sign out
        </button>
      </header>
      <Board />
    </main>
  )
}
