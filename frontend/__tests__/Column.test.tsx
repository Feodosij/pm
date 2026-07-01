import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { Column } from '../src/components/Column'
import type { Column as ColumnType } from '../src/lib/types'

const col: ColumnType = {
  id: 'col1',
  title: 'Backlog',
  cards: [
    { id: 'c1', title: 'Task One', details: 'details' },
  ],
}

function renderColumn(props: Partial<Parameters<typeof Column>[0]> = {}) {
  return render(
    <DndContext>
      <Column
        column={col}
        onAddCard={vi.fn()}
        onDeleteCard={vi.fn()}
        onRenameColumn={vi.fn()}
        {...props}
      />
    </DndContext>
  )
}

describe('Column', () => {
  it('renders the column title', () => {
    renderColumn()
    expect(screen.getByText('Backlog')).toBeInTheDocument()
  })

  it('renders the card count badge', () => {
    renderColumn()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('renders the card inside it', () => {
    renderColumn()
    expect(screen.getByText('Task One')).toBeInTheDocument()
  })

  it('shows AddCardForm when Add card button is clicked', () => {
    renderColumn()
    fireEvent.click(screen.getByRole('button', { name: /add card/i }))
    expect(screen.getByPlaceholderText('Card title')).toBeInTheDocument()
  })

  it('calls onRenameColumn when title is edited and Enter is pressed', () => {
    const onRenameColumn = vi.fn()
    renderColumn({ onRenameColumn })
    fireEvent.click(screen.getByText('Backlog'))
    const input = screen.getByDisplayValue('Backlog')
    fireEvent.change(input, { target: { value: 'New Name' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onRenameColumn).toHaveBeenCalledWith('col1', 'New Name')
  })

  it('reverts the title and skips onRenameColumn when Escape is pressed', () => {
    const onRenameColumn = vi.fn()
    renderColumn({ onRenameColumn })
    fireEvent.click(screen.getByText('Backlog'))
    const input = screen.getByDisplayValue('Backlog')
    fireEvent.change(input, { target: { value: 'Should not save' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onRenameColumn).not.toHaveBeenCalled()
    expect(screen.getByText('Backlog')).toBeInTheDocument()
  })

  it('reverts the title and skips onRenameColumn when committed with an empty value', () => {
    const onRenameColumn = vi.fn()
    renderColumn({ onRenameColumn })
    fireEvent.click(screen.getByText('Backlog'))
    const input = screen.getByDisplayValue('Backlog')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onRenameColumn).not.toHaveBeenCalled()
    expect(screen.getByText('Backlog')).toBeInTheDocument()
  })
})
