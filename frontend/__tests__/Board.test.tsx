import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { Board } from '../src/components/Board'

describe('Board', () => {
  it('renders all columns from the initial board', () => {
    render(<Board />)
    expect(screen.getByText('Backlog')).toBeInTheDocument()
    expect(screen.getByText('To Do')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
    expect(screen.getByText('Review')).toBeInTheDocument()
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  it('adds a card through a column', () => {
    render(<Board />)
    const backlog = screen.getAllByTestId('column')[0]
    fireEvent.click(within(backlog).getByRole('button', { name: /add card/i }))
    fireEvent.change(within(backlog).getByPlaceholderText('Card title'), {
      target: { value: 'New task' },
    })
    fireEvent.click(within(backlog).getByRole('button', { name: 'Add Card', exact: true }))
    expect(within(backlog).getByText('New task')).toBeInTheDocument()
  })

  it('deletes a card through a column', () => {
    render(<Board />)
    const backlog = screen.getAllByTestId('column')[0]
    const card = within(backlog).getByText('Research competitors').closest('[data-testid="card"]')!
    fireEvent.click(within(card as HTMLElement).getByRole('button', { name: /delete card/i }))
    expect(within(backlog).queryByText('Research competitors')).not.toBeInTheDocument()
  })

  it('renames a column', () => {
    render(<Board />)
    const backlog = screen.getAllByTestId('column')[0]
    fireEvent.click(within(backlog).getByText('Backlog'))
    const input = within(backlog).getByDisplayValue('Backlog')
    fireEvent.change(input, { target: { value: 'Sprint 1' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(within(backlog).getByText('Sprint 1')).toBeInTheDocument()
  })
})
