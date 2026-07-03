import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchMe, login, logout, fetchBoard, apiCreateCard, apiEditCard, apiMoveCard, apiDeleteCard, apiRenameColumn, apiChat } from '../src/lib/api'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => mockFetch.mockClear())

function okJson(data: unknown) {
  return { ok: true, json: () => Promise.resolve(data) }
}

describe('fetchMe', () => {
  it('calls /api/me with credentials and returns the json', async () => {
    mockFetch.mockResolvedValue(okJson({ authenticated: true, username: 'user' }))
    const result = await fetchMe()
    expect(result).toEqual({ authenticated: true, username: 'user' })
    expect(mockFetch).toHaveBeenCalledWith('/api/me', { credentials: 'include' })
  })
})

describe('login', () => {
  it('posts credentials and returns ok on success', async () => {
    mockFetch.mockResolvedValue(okJson({ ok: true }))
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

describe('fetchBoard', () => {
  it('returns the board JSON', async () => {
    const board = { id: '1', title: 'Board', columns: [] }
    mockFetch.mockResolvedValue(okJson(board))
    expect(await fetchBoard()).toEqual(board)
    expect(mockFetch).toHaveBeenCalledWith('/api/board', { credentials: 'include' })
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    await expect(fetchBoard()).rejects.toThrow('Failed to load board')
  })
})

describe('apiCreateCard', () => {
  it('posts to /api/board/cards and returns card', async () => {
    const card = { id: '5', title: 'New', details: 'desc' }
    mockFetch.mockResolvedValue(okJson(card))
    expect(await apiCreateCard('col1', 'New', 'desc')).toEqual(card)
    expect(mockFetch).toHaveBeenCalledWith('/api/board/cards', expect.objectContaining({ method: 'POST' }))
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    await expect(apiCreateCard('col1', 'X', '')).rejects.toThrow('Failed to create card')
  })
})

describe('apiEditCard', () => {
  it('patches the card and returns updated card', async () => {
    const card = { id: '1', title: 'Edited', details: 'new' }
    mockFetch.mockResolvedValue(okJson(card))
    expect(await apiEditCard('1', 'Edited', 'new')).toEqual(card)
    expect(mockFetch).toHaveBeenCalledWith('/api/board/cards/1', expect.objectContaining({ method: 'PATCH' }))
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    await expect(apiEditCard('1', 'X', '')).rejects.toThrow('Failed to edit card')
  })
})

describe('apiMoveCard', () => {
  it('patches with column_id and position', async () => {
    const card = { id: '1', title: 'T', details: '' }
    mockFetch.mockResolvedValue(okJson(card))
    await apiMoveCard('1', 'col2', 0)
    const call = mockFetch.mock.calls[0]
    expect(call[1].method).toBe('PATCH')
    expect(JSON.parse(call[1].body)).toEqual({ column_id: 'col2', position: 0 })
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    await expect(apiMoveCard('1', 'col2', 0)).rejects.toThrow('Failed to move card')
  })
})

describe('apiDeleteCard', () => {
  it('sends DELETE to /api/board/cards/{id}', async () => {
    mockFetch.mockResolvedValue({ ok: true })
    await apiDeleteCard('3')
    expect(mockFetch).toHaveBeenCalledWith('/api/board/cards/3', expect.objectContaining({ method: 'DELETE' }))
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    await expect(apiDeleteCard('3')).rejects.toThrow('Failed to delete card')
  })
})

describe('apiRenameColumn', () => {
  it('patches the column title', async () => {
    mockFetch.mockResolvedValue({ ok: true })
    await apiRenameColumn('col1', 'New Name')
    const call = mockFetch.mock.calls[0]
    expect(call[1].method).toBe('PATCH')
    expect(JSON.parse(call[1].body)).toEqual({ title: 'New Name' })
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    await expect(apiRenameColumn('col1', 'X')).rejects.toThrow('Failed to rename column')
  })
})

describe('apiChat', () => {
  it('posts message and history to /api/chat and returns response', async () => {
    const chatResponse = { reply: 'Sure!', board_update: null }
    mockFetch.mockResolvedValue(okJson(chatResponse))
    const history = [{ role: 'user' as const, content: 'hi' }]
    const result = await apiChat('hello', history)
    expect(result).toEqual(chatResponse)
    const call = mockFetch.mock.calls[0]
    expect(call[0]).toBe('/api/chat')
    expect(call[1].method).toBe('POST')
    expect(JSON.parse(call[1].body)).toEqual({ message: 'hello', history })
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    await expect(apiChat('hi', [])).rejects.toThrow('Chat request failed')
  })
})
