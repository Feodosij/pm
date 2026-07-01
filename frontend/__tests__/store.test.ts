import { describe, it, expect } from 'vitest'
import { boardReducer } from '../src/lib/store'
import type { BoardState } from '../src/lib/types'

const baseState: BoardState = {
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

describe('boardReducer', () => {
  it('adds a card to the specified column', () => {
    const next = boardReducer(baseState, {
      type: 'ADD_CARD',
      columnId: 'col1',
      title: 'New Task',
      details: 'Some details',
    })
    expect(next.columns[0].cards).toHaveLength(3)
    expect(next.columns[0].cards[2].title).toBe('New Task')
    expect(next.columns[0].cards[2].details).toBe('Some details')
    expect(next.columns[0].cards[2].id).toBeTruthy()
  })

  it('does not mutate other columns when adding a card', () => {
    const next = boardReducer(baseState, {
      type: 'ADD_CARD',
      columnId: 'col1',
      title: 'X',
      details: '',
    })
    expect(next.columns[1].cards).toHaveLength(0)
  })

  it('deletes a card from a column', () => {
    const next = boardReducer(baseState, {
      type: 'DELETE_CARD',
      columnId: 'col1',
      cardId: 'card1',
    })
    expect(next.columns[0].cards).toHaveLength(1)
    expect(next.columns[0].cards[0].id).toBe('card2')
  })

  it('moves a card to another column', () => {
    const next = boardReducer(baseState, {
      type: 'MOVE_CARD',
      sourceColumnId: 'col1',
      destColumnId: 'col2',
      cardId: 'card1',
      destIndex: 0,
    })
    expect(next.columns[0].cards).toHaveLength(1)
    expect(next.columns[0].cards[0].id).toBe('card2')
    expect(next.columns[1].cards).toHaveLength(1)
    expect(next.columns[1].cards[0].id).toBe('card1')
  })

  it('reorders a card within the same column', () => {
    const next = boardReducer(baseState, {
      type: 'MOVE_CARD',
      sourceColumnId: 'col1',
      destColumnId: 'col1',
      cardId: 'card1',
      destIndex: 1,
    })
    expect(next.columns[0].cards[0].id).toBe('card2')
    expect(next.columns[0].cards[1].id).toBe('card1')
  })

  it('renames a column', () => {
    const next = boardReducer(baseState, {
      type: 'RENAME_COLUMN',
      columnId: 'col1',
      title: 'Renamed',
    })
    expect(next.columns[0].title).toBe('Renamed')
    expect(next.columns[1].title).toBe('In Progress')
  })
})
