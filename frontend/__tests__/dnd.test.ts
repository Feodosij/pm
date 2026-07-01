import { describe, it, expect } from 'vitest'
import { findCardById, resolveDragMove } from '../src/lib/dnd'
import type { BoardState } from '../src/lib/types'

const columns: BoardState['columns'] = [
  {
    id: 'col1',
    title: 'Backlog',
    cards: [
      { id: 'card1', title: 'Task 1', details: '' },
      { id: 'card2', title: 'Task 2', details: '' },
    ],
  },
  { id: 'col2', title: 'In Progress', cards: [] },
]

describe('findCardById', () => {
  it('finds a card in any column', () => {
    expect(findCardById(columns, 'card2')).toEqual({ id: 'card2', title: 'Task 2', details: '' })
  })

  it('returns null when the card does not exist', () => {
    expect(findCardById(columns, 'missing')).toBeNull()
  })
})

describe('resolveDragMove', () => {
  it('returns null when dropped on itself', () => {
    expect(resolveDragMove(columns, 'card1', 'card1')).toBeNull()
  })

  it('returns null when the active card cannot be found', () => {
    expect(resolveDragMove(columns, 'missing', 'card2')).toBeNull()
  })

  it('returns null when dropped over an unknown target', () => {
    expect(resolveDragMove(columns, 'card1', 'missing')).toBeNull()
  })

  it('resolves a move onto an empty column by id', () => {
    expect(resolveDragMove(columns, 'card1', 'col2')).toEqual({
      sourceColumnId: 'col1',
      destColumnId: 'col2',
      destIndex: 0,
    })
  })

  it('resolves a move onto another card, inserting at that index', () => {
    expect(resolveDragMove(columns, 'card1', 'card2')).toEqual({
      sourceColumnId: 'col1',
      destColumnId: 'col1',
      destIndex: 1,
    })
  })
})
