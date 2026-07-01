'use client'
import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Card } from './Card'
import { AddCardForm } from './AddCardForm'
import type { Column as ColumnType } from '@/lib/types'

type Props = {
  column: ColumnType
  onAddCard: (columnId: string, title: string, details: string) => void
  onDeleteCard: (columnId: string, cardId: string) => void
  onEditCard: (cardId: string, title: string, details: string) => Promise<void>
  onRenameColumn: (columnId: string, title: string) => void
}

export function Column({ column, onAddCard, onDeleteCard, onEditCard, onRenameColumn }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [titleValue, setTitleValue] = useState(column.title)
  const [isAddingCard, setIsAddingCard] = useState(false)

  const { setNodeRef } = useDroppable({ id: column.id })

  function commitRename() {
    const trimmed = titleValue.trim()
    if (trimmed && trimmed !== column.title) {
      onRenameColumn(column.id, trimmed)
    } else {
      setTitleValue(column.title)
    }
    setIsEditing(false)
  }

  return (
    <div
      data-testid="column"
      className="flex flex-col w-72 shrink-0 bg-[#f1f5f9] rounded-xl shadow-sm"
    >
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-gray-200">
        {isEditing ? (
          <input
            autoFocus
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') {
                setTitleValue(column.title)
                setIsEditing(false)
              }
            }}
            className="flex-1 text-sm font-bold text-[#032147] bg-white border border-[#209dd7] rounded px-2 py-0.5 focus:outline-none"
          />
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="flex-1 text-sm font-bold text-[#032147] hover:text-[#209dd7] transition-colors text-left truncate"
          >
            {column.title}
          </button>
        )}
        <span className="shrink-0 text-xs font-medium text-[#888888] bg-white rounded-full px-2 py-0.5 border border-gray-200">
          {column.cards.length}
        </span>
      </div>

      <div ref={setNodeRef} className="flex-1 px-3 py-3 space-y-2 min-h-[80px]">
        <SortableContext items={column.cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {column.cards.map(card => (
            <Card
              key={card.id}
              card={card}
              columnId={column.id}
              onDelete={onDeleteCard}
              onEdit={onEditCard}
            />
          ))}
        </SortableContext>
      </div>

      <div className="px-3 pb-3">
        {isAddingCard ? (
          <AddCardForm
            columnId={column.id}
            onAdd={onAddCard}
            onClose={() => setIsAddingCard(false)}
          />
        ) : (
          <button
            onClick={() => setIsAddingCard(true)}
            aria-label="Add card"
            className="w-full py-2 text-sm font-medium text-[#209dd7] hover:bg-[#209dd7] hover:text-white rounded-lg transition-all border border-dashed border-[#209dd7]/60 hover:border-[#209dd7]"
          >
            + Add card
          </button>
        )}
      </div>
    </div>
  )
}
