import { useReducer } from 'react'
import { initialBoard } from './data'
import type { BoardState } from './types'

type Action =
  | { type: 'ADD_CARD'; columnId: string; title: string; details: string }
  | { type: 'DELETE_CARD'; columnId: string; cardId: string }
  | { type: 'MOVE_CARD'; sourceColumnId: string; destColumnId: string; cardId: string; destIndex: number }
  | { type: 'RENAME_COLUMN'; columnId: string; title: string }

export function boardReducer(state: BoardState, action: Action): BoardState {
  switch (action.type) {
    case 'ADD_CARD':
      return {
        columns: state.columns.map(col =>
          col.id === action.columnId
            ? {
                ...col,
                cards: [
                  ...col.cards,
                  { id: crypto.randomUUID(), title: action.title, details: action.details },
                ],
              }
            : col
        ),
      }

    case 'DELETE_CARD':
      return {
        columns: state.columns.map(col =>
          col.id === action.columnId
            ? { ...col, cards: col.cards.filter(c => c.id !== action.cardId) }
            : col
        ),
      }

    case 'MOVE_CARD': {
      const sourceCol = state.columns.find(c => c.id === action.sourceColumnId)!
      const card = sourceCol.cards.find(c => c.id === action.cardId)!
      return {
        columns: state.columns.map(col => {
          if (col.id === action.sourceColumnId && col.id === action.destColumnId) {
            const cards = col.cards.filter(c => c.id !== action.cardId)
            cards.splice(action.destIndex, 0, card)
            return { ...col, cards }
          }
          if (col.id === action.sourceColumnId) {
            return { ...col, cards: col.cards.filter(c => c.id !== action.cardId) }
          }
          if (col.id === action.destColumnId) {
            const cards = [...col.cards]
            cards.splice(action.destIndex, 0, card)
            return { ...col, cards }
          }
          return col
        }),
      }
    }

    case 'RENAME_COLUMN':
      return {
        columns: state.columns.map(col =>
          col.id === action.columnId ? { ...col, title: action.title } : col
        ),
      }

    default:
      return state
  }
}

export function useBoard() {
  const [state, dispatch] = useReducer(boardReducer, initialBoard)
  return {
    columns: state.columns,
    addCard: (columnId: string, title: string, details: string) =>
      dispatch({ type: 'ADD_CARD', columnId, title, details }),
    deleteCard: (columnId: string, cardId: string) =>
      dispatch({ type: 'DELETE_CARD', columnId, cardId }),
    moveCard: (sourceColumnId: string, destColumnId: string, cardId: string, destIndex: number) =>
      dispatch({ type: 'MOVE_CARD', sourceColumnId, destColumnId, cardId, destIndex }),
    renameColumn: (columnId: string, title: string) =>
      dispatch({ type: 'RENAME_COLUMN', columnId, title }),
  }
}
