import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchMe, login, logout } from '../src/lib/api'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => mockFetch.mockClear())

describe('fetchMe', () => {
  it('calls /api/me with credentials and returns the json', async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ authenticated: true, username: 'user' }) })
    const result = await fetchMe()
    expect(result).toEqual({ authenticated: true, username: 'user' })
    expect(mockFetch).toHaveBeenCalledWith('/api/me', { credentials: 'include' })
  })
})

describe('login', () => {
  it('posts credentials and returns ok on success', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) })
    const result = await login('user', 'password')
    expect(result).toEqual({ ok: true })
    expect(mockFetch).toHaveBeenCalledWith('/api/login', expect.objectContaining({ method: 'POST' }))
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    await expect(login('user', 'wrong')).rejects.toThrow('Invalid credentials')
  })
})

describe('logout', () => {
  it('calls /api/logout with POST', async () => {
    mockFetch.mockResolvedValue({})
    await logout()
    expect(mockFetch).toHaveBeenCalledWith('/api/logout', { method: 'POST', credentials: 'include' })
  })
})
