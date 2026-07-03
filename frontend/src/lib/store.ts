import { useState, useCallback } from 'react'
import type { BoardState } from './types'
import {
  fetchBoard,
  apiCreateCard,
  apiEditCard,
  apiMoveCard,
  apiDeleteCard,
  apiRenameColumn,
} from './api'

export type BoardHook = {
  columns: BoardState['columns']
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  addCard: (columnId: string, title: string, details: string) => Promise<void>
  editCard: (cardId: string, title: string, details: string) => Promise<void>
  deleteCard: (columnId: string, cardId: string) => Promise<void>
  moveCard: (sourceColumnId: string, destColumnId: string, cardId: string, destIndex: number) => Promise<void>
  renameColumn: (columnId: string, title: string) => Promise<void>
}

export function useBoard(): BoardHook {
  const [state, setState] = useState<BoardState>({ columns: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const board = await fetchBoard()
      setState(board)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load board')
    } finally {
      setLoading(false)
    }
  }, [])

  const addCard = useCallback(async (columnId: string, title: string, details: string) => {
    const card = await apiCreateCard(columnId, title, details)
    setState(prev => ({
      columns: prev.columns.map(col =>
        col.id === columnId ? { ...col, cards: [...col.cards, card] } : col
      ),
    }))
  }, [])

  const editCard = useCallback(async (cardId: string, title: string, details: string) => {
    const updated = await apiEditCard(cardId, title, details)
    setState(prev => ({
      columns: prev.columns.map(col => ({
        ...col,
        cards: col.cards.map(c => (c.id === cardId ? updated : c)),
      })),
    }))
  }, [])

  const deleteCard = useCallback(async (_columnId: string, cardId: string) => {
    await apiDeleteCard(cardId)
    setState(prev => ({
      columns: prev.columns.map(col => ({
        ...col,
        cards: col.cards.filter(c => c.id !== cardId),
      })),
    }))
  }, [])

  const moveCard = useCallback(
    async (sourceColumnId: string, destColumnId: string, cardId: string, destIndex: number) => {
      // Optimistic update before the API call so the UI moves instantly.
      setState(prev => {
        const sourceCol = prev.columns.find(c => c.id === sourceColumnId)
        if (!sourceCol) return prev
        const card = sourceCol.cards.find(c => c.id === cardId)
        if (!card) return prev
        return {
          columns: prev.columns.map(col => {
            if (col.id === sourceColumnId && col.id === destColumnId) {
              const cards = col.cards.filter(c => c.id !== cardId)
              cards.splice(destIndex, 0, card)
              return { ...col, cards }
            }
            if (col.id === sourceColumnId) return { ...col, cards: col.cards.filter(c => c.id !== cardId) }
            if (col.id === destColumnId) {
              const cards = [...col.cards]
              cards.splice(destIndex, 0, card)
              return { ...col, cards }
            }
            return col
          }),
        }
      })
      try {
        await apiMoveCard(cardId, destColumnId, destIndex)
      } catch {
        await reload()
      }
    },
    [reload]
  )

  const renameColumn = useCallback(async (columnId: string, title: string) => {
    await apiRenameColumn(columnId, title)
    setState(prev => ({
      columns: prev.columns.map(col =>
        col.id === columnId ? { ...col, title } : col
      ),
    }))
  }, [])

  return { columns: state.columns, loading, error, reload, addCard, editCard, deleteCard, moveCard, renameColumn }
}
