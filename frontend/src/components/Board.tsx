'use client'
import { useEffect, useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { Column } from './Column'
import { useBoard } from '@/lib/store'
import { findCardById, resolveDragMove } from '@/lib/dnd'
import type { Card as CardType } from '@/lib/types'

type BoardProps = {
  reloadKey?: number
}

export function Board({ reloadKey }: BoardProps) {
  const { columns, loading, error, reload, addCard, editCard, deleteCard, moveCard, renameColumn } = useBoard()
  const [activeCard, setActiveCard] = useState<CardType | null>(null)

  useEffect(() => {
    reload()
  }, [reload, reloadKey])

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <p className="text-white/40 text-sm">Loading board…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] gap-3">
        <p className="text-red-400 text-sm">{error}</p>
        <button
          onClick={reload}
          className="text-xs text-[#209dd7] hover:underline"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
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
            onEditCard={editCard}
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
