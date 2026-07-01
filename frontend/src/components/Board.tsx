'use client'
import { useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { Column } from './Column'
import { useBoard } from '@/lib/store'
import { findCardById, resolveDragMove } from '@/lib/dnd'
import type { Card as CardType } from '@/lib/types'

export function Board() {
  const { columns, addCard, deleteCard, moveCard, renameColumn } = useBoard()
  const [activeCard, setActiveCard] = useState<CardType | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  function handleDragStart({ active }: DragStartEvent) {
    setActiveCard(findCardById(columns, active.id as string))
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveCard(null)
    if (!over) return

    const result = resolveDragMove(columns, active.id as string, over.id as string)
    if (!result) return

    moveCard(result.sourceColumnId, result.destColumnId, active.id as string, result.destIndex)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-5 px-6 py-6 overflow-x-auto min-h-[calc(100vh-64px)]">
        {columns.map(column => (
          <Column
            key={column.id}
            column={column}
            onAddCard={addCard}
            onDeleteCard={deleteCard}
            onRenameColumn={renameColumn}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
        {activeCard && (
          <div className="bg-white rounded-lg p-3 shadow-2xl border-l-2 border-[#ecad0a] rotate-1 opacity-95 w-72 cursor-grabbing">
            <div className="pl-3 pr-2">
              <p className="text-sm font-semibold text-[#032147]">{activeCard.title}</p>
              {activeCard.details && (
                <p className="mt-1 text-xs text-[#888888] line-clamp-2">{activeCard.details}</p>
              )}
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
