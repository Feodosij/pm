'use client'
import { useState, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Card as CardType } from '@/lib/types'

type Props = {
  card: CardType
  columnId: string
  onDelete: (columnId: string, cardId: string) => void
  onEdit: (cardId: string, title: string, details: string) => Promise<void>
}

export function Card({ card, columnId, onDelete, onEdit }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id })

  const [editing, setEditing] = useState(false)
  const [titleValue, setTitleValue] = useState(card.title)
  const [detailsValue, setDetailsValue] = useState(card.details)
  const titleRef = useRef<HTMLInputElement>(null)

  function startEdit() {
    setTitleValue(card.title)
    setDetailsValue(card.details)
    setEditing(true)
  }

  async function commitEdit() {
    const t = titleValue.trim()
    if (!t) {
      cancelEdit()
      return
    }
    setEditing(false)
    await onEdit(card.id, t, detailsValue.trim())
  }

  function cancelEdit() {
    setTitleValue(card.title)
    setDetailsValue(card.details)
    setEditing(false)
  }

  if (editing) {
    return (
      <div
        ref={setNodeRef}
        data-testid="card"
        className="bg-white rounded-lg p-3 shadow-sm border border-[#209dd7]"
      >
        <div className="border-l-2 border-[#ecad0a] pl-3 pr-1 space-y-1.5">
          <input
            ref={titleRef}
            autoFocus
            value={titleValue}
            onChange={e => setTitleValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') commitEdit()
              if (e.key === 'Escape') cancelEdit()
            }}
            className="w-full text-sm font-semibold text-[#032147] bg-[#f1f5f9] border border-gray-200 rounded px-2 py-0.5 focus:outline-none focus:border-[#209dd7]"
            data-testid="card-title-input"
          />
          <textarea
            value={detailsValue}
            onChange={e => setDetailsValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') cancelEdit()
            }}
            onBlur={commitEdit}
            rows={2}
            placeholder="Details (optional)"
            className="w-full text-xs text-[#888888] bg-[#f1f5f9] border border-gray-200 rounded px-2 py-0.5 focus:outline-none focus:border-[#209dd7] resize-none"
            data-testid="card-details-input"
          />
        </div>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      {...attributes}
      {...listeners}
      data-testid="card"
      className="group relative bg-white rounded-lg p-3 shadow-sm border border-gray-100 cursor-grab active:cursor-grabbing hover:shadow-md transition-all"
    >
      <div className="border-l-2 border-[#ecad0a] pl-3 pr-6">
        <p className="text-sm font-semibold text-[#032147] leading-snug">{card.title}</p>
        {card.details && (
          <p className="mt-1 text-xs text-[#888888] line-clamp-2 leading-relaxed">{card.details}</p>
        )}
      </div>
      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={() => startEdit()}
        aria-label="Edit card"
        className="absolute top-2 right-7 w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 text-[#888888] hover:text-[#209dd7] hover:bg-blue-50 transition-all text-xs leading-none"
      >
        ✎
      </button>
      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={() => onDelete(columnId, card.id)}
        aria-label="Delete card"
        className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 text-[#888888] hover:text-[#753991] hover:bg-purple-50 transition-all text-xs leading-none"
      >
        ✕
      </button>
    </div>
  )
}
