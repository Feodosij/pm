'use client'
import { useState, FormEvent } from 'react'
import { login } from '@/lib/api'

type Props = { onSuccess: () => void }

export function Login({ onSuccess }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      onSuccess()
    } catch {
      setError('Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#032147] flex items-center justify-center">
      <div className="w-full max-w-sm px-4">
        <h1 className="text-2xl font-bold text-white tracking-wider uppercase text-center mb-8">
          Kanban
        </h1>
        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-8 space-y-4 shadow-2xl">
          <h2 className="text-lg font-semibold text-[#032147] mb-2">Sign in</h2>
          {error && (
            <p role="alert" className="text-sm text-red-600 font-medium">
              {error}
            </p>
          )}
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Username"
            autoComplete="username"
            required
            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[#209dd7] text-[#032147] placeholder-[#888888]"
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            required
            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[#209dd7] text-[#032147] placeholder-[#888888]"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 font-semibold bg-[#753991] text-white rounded-lg hover:bg-[#5d2e74] transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  )
}
