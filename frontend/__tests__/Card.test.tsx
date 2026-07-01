import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import { Card } from '../src/components/Card'

const card = { id: 'c1', title: 'My Task', details: 'Some details here' }

function renderCard(onDelete = vi.fn(), onEdit: (id: string, t: string, d: string) => Promise<void> = vi.fn().mockResolvedValue(undefined)) {
  return render(
    <DndContext>
      <SortableContext items={['c1']}>
        <Card card={card} columnId="col1" onDelete={onDelete} onEdit={onEdit} />
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

  it('enters edit mode when edit button is clicked', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: /edit card/i }))
    expect(screen.getByTestId('card-title-input')).toBeInTheDocument()
    expect(screen.getByTestId('card-details-input')).toBeInTheDocument()
  })

  it('calls onEdit and exits edit mode on Enter', async () => {
    const onEdit = vi.fn().mockResolvedValue(undefined)
    renderCard(vi.fn(), onEdit)
    fireEvent.click(screen.getByRole('button', { name: /edit card/i }))
    const titleInput = screen.getByTestId('card-title-input')
    fireEvent.change(titleInput, { target: { value: 'Updated title' } })
    await act(async () => {
      fireEvent.keyDown(titleInput, { key: 'Enter' })
    })
    expect(onEdit).toHaveBeenCalledWith('c1', 'Updated title', 'Some details here')
    expect(screen.queryByTestId('card-title-input')).not.toBeInTheDocument()
  })

  it('cancels edit on Escape without calling onEdit', () => {
    const onEdit = vi.fn().mockResolvedValue(undefined)
    renderCard(vi.fn(), onEdit)
    fireEvent.click(screen.getByRole('button', { name: /edit card/i }))
    const titleInput = screen.getByTestId('card-title-input')
    fireEvent.change(titleInput, { target: { value: 'Changed' } })
    fireEvent.keyDown(titleInput, { key: 'Escape' })
    expect(onEdit).not.toHaveBeenCalled()
    expect(screen.queryByTestId('card-title-input')).not.toBeInTheDocument()
    expect(screen.getByText('My Task')).toBeInTheDocument()
  })
})
