import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBoard } from '../src/lib/store'
import * as api from '../src/lib/api'

vi.mock('../src/lib/api')

const mockBoard = {
  id: '1',
  title: 'My Board',
  columns: [
    {
      id: 'col1',
      title: 'Backlog',
      cards: [
        { id: 'card1', title: 'Task 1', details: 'Details 1' },
        { id: 'card2', title: 'Task 2', details: 'Details 2' },
      ],
    },
    { id: 'col2', title: 'In Progress', cards: [] },
  ],
}

beforeEach(() => {
  vi.mocked(api.fetchBoard).mockResolvedValue(mockBoard)
  vi.mocked(api.apiCreateCard).mockResolvedValue({ id: 'new', title: 'New', details: '' })
  vi.mocked(api.apiEditCard).mockResolvedValue({ id: 'card1', title: 'Edited', details: 'New details' })
  vi.mocked(api.apiDeleteCard).mockResolvedValue(undefined)
  vi.mocked(api.apiMoveCard).mockResolvedValue({ id: 'card1', title: 'Task 1', details: 'Details 1' })
  vi.mocked(api.apiRenameColumn).mockResolvedValue(undefined)
})

describe('useBoard', () => {
  it('starts in loading state', () => {
    const { result } = renderHook(() => useBoard())
    expect(result.current.loading).toBe(true)
  })

  it('loads board on reload()', async () => {
    const { result } = renderHook(() => useBoard())
    await act(() => result.current.reload())
    expect(result.current.loading).toBe(false)
    expect(result.current.columns).toHaveLength(2)
    expect(result.current.columns[0].title).toBe('Backlog')
  })

  it('sets error when fetchBoard rejects', async () => {
    vi.mocked(api.fetchBoard).mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useBoard())
    await act(() => result.current.reload())
    expect(result.current.error).toBe('Network error')
    expect(result.current.loading).toBe(false)
  })

  it('addCard appends the new card to the correct column', async () => {
    vi.mocked(api.apiCreateCard).mockResolvedValue({ id: 'new1', title: 'New Task', details: 'desc' })
    const { result } = renderHook(() => useBoard())
    await act(() => result.current.reload())
    await act(() => result.current.addCard('col1', 'New Task', 'desc'))
    const col1 = result.current.columns.find(c => c.id === 'col1')!
    expect(col1.cards.at(-1)?.title).toBe('New Task')
  })

  it('editCard updates the card in state', async () => {
    const { result } = renderHook(() => useBoard())
    await act(() => result.current.reload())
    await act(() => result.current.editCard('card1', 'Edited', 'New details'))
    const col1 = result.current.columns.find(c => c.id === 'col1')!
    expect(col1.cards[0].title).toBe('Edited')
    expect(col1.cards[0].details).toBe('New details')
  })

  it('deleteCard removes the card from state', async () => {
    const { result } = renderHook(() => useBoard())
    await act(() => result.current.reload())
    await act(() => result.current.deleteCard('col1', 'card1'))
    const col1 = result.current.columns.find(c => c.id === 'col1')!
    expect(col1.cards).toHaveLength(1)
    expect(col1.cards[0].id).toBe('card2')
  })

  it('moveCard moves a card to another column in state', async () => {
    const { result } = renderHook(() => useBoard())
    await act(() => result.current.reload())
    await act(() => result.current.moveCard('col1', 'col2', 'card1', 0))
    const col1 = result.current.columns.find(c => c.id === 'col1')!
    const col2 = result.current.columns.find(c => c.id === 'col2')!
    expect(col1.cards).toHaveLength(1)
    expect(col2.cards).toHaveLength(1)
    expect(col2.cards[0].id).toBe('card1')
  })

  it('moveCard reorders within the same column', async () => {
    const { result } = renderHook(() => useBoard())
    await act(() => result.current.reload())
    await act(() => result.current.moveCard('col1', 'col1', 'card1', 1))
    const col1 = result.current.columns.find(c => c.id === 'col1')!
    expect(col1.cards[1].id).toBe('card1')
    expect(col1.cards[0].id).toBe('card2')
  })

  it('renameColumn updates the column title in state', async () => {
    const { result } = renderHook(() => useBoard())
    await act(() => result.current.reload())
    await act(() => result.current.renameColumn('col1', 'Renamed'))
    expect(result.current.columns[0].title).toBe('Renamed')
  })
})
