import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import { Card } from '../src/components/Card'

const card = { id: 'c1', title: 'My Task', details: 'Some details here' }

function renderCard(onDelete = vi.fn()) {
  return render(
    <DndContext>
      <SortableContext items={['c1']}>
        <Card card={card} columnId="col1" onDelete={onDelete} />
      </SortableContext>
    </DndContext>
  )
}

describe('Card', () => {
  it('renders the card title', () => {
    renderCard()
    expect(screen.getByText('My Task')).toBeInTheDocument()
  })

  it('renders the card details', () => {
    renderCard()
    expect(screen.getByText('Some details here')).toBeInTheDocument()
  })

  it('calls onDelete with correct args when delete button is clicked', () => {
    const onDelete = vi.fn()
    renderCard(onDelete)
    fireEvent.click(screen.getByRole('button', { name: /delete card/i }))
    expect(onDelete).toHaveBeenCalledWith('col1', 'c1')
  })

  it('stops pointer-down propagation on the delete button so it does not start a drag', () => {
    renderCard()
    const button = screen.getByRole('button', { name: /delete card/i })
    const event = new MouseEvent('pointerdown', { bubbles: true, cancelable: true })
    const stopPropagationSpy = vi.spyOn(event, 'stopPropagation')
    button.dispatchEvent(event)
    expect(stopPropagationSpy).toHaveBeenCalled()
  })
})
