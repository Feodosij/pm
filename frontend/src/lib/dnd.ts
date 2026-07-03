import type { BoardState, Card } from './types'

export function findCardById(columns: BoardState['columns'], cardId: string): Card | null {
  for (const col of columns) {
    const card = col.cards.find(c => c.id === cardId)
    if (card) return card
  }
  return null
}

export type DragMoveResult = {
  sourceColumnId: string
  destColumnId: string
  destIndex: number
} | null

export function resolveDragMove(
  columns: BoardState['columns'],
  activeId: string,
  overId: string
): DragMoveResult {
  if (activeId === overId) return null

  const sourceColumn = columns.find(col => col.cards.some(c => c.id === activeId))
  if (!sourceColumn) return null

  // overId is either `col-${columnId}` (column droppable) or a card id.
  // Prefix check must come first to avoid matching card ids against column ids.
  const destColumn =
    columns.find(col => `col-${col.id}` === overId) ??
    columns.find(col => col.cards.some(c => c.id === overId))
  if (!destColumn) return null

  const overCardIndex = destColumn.cards.findIndex(c => c.id === overId)
  const destIndex = overCardIndex === -1 ? destColumn.cards.length : overCardIndex

  return { sourceColumnId: sourceColumn.id, destColumnId: destColumn.id, destIndex }
}
