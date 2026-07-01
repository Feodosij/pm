'use client'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Card as CardType } from '@/lib/types'

type Props = {
  card: CardType
  columnId: string
  onDelete: (columnId: string, cardId: string) => void
}

export function Card({ card, columnId, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id })

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
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onDelete(columnId, card.id)}
        aria-label="Delete card"
        className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 text-[#888888] hover:text-[#753991] hover:bg-purple-50 transition-all text-xs leading-none"
      >
        ✕
      </button>
    </div>
  )
}
