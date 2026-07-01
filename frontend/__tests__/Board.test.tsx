import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import { Board } from '../src/components/Board'
import * as store from '../src/lib/store'

vi.mock('../src/lib/store')

const mockColumns = [
  {
    id: 'col1',
    title: 'Backlog',
    cards: [{ id: 'card1', title: 'Research competitors', details: '' }],
  },
  { id: 'col2', title: 'To Do', cards: [] },
  { id: 'col3', title: 'In Progress', cards: [] },
  { id: 'col4', title: 'Review', cards: [] },
  { id: 'col5', title: 'Done', cards: [] },
]

function mockUseBoard(overrides: Partial<ReturnType<typeof store.useBoard>> = {}) {
  vi.mocked(store.useBoard).mockReturnValue({
    columns: mockColumns,
    loading: false,
    error: null,
    reload: vi.fn().mockResolvedValue(undefined),
    addCard: vi.fn().mockResolvedValue(undefined),
    editCard: vi.fn().mockResolvedValue(undefined),
    deleteCard: vi.fn().mockResolvedValue(undefined),
    moveCard: vi.fn().mockResolvedValue(undefined),
    renameColumn: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  })
}

beforeEach(() => {
  mockUseBoard()
})

describe('Board', () => {
  it('shows loading state', () => {
    mockUseBoard({ loading: true })
    render(<Board />)
    expect(screen.getByText(/loading board/i)).toBeInTheDocument()
  })

  it('shows error state with retry button', () => {
    const reload = vi.fn().mockResolvedValue(undefined)
    mockUseBoard({ error: 'Network error', loading: false, reload })
    render(<Board />)
    expect(screen.getByText('Network error')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Retry'))
    expect(reload).toHaveBeenCalled()
  })

  it('renders all columns', () => {
    render(<Board />)
    expect(screen.getByText('Backlog')).toBeInTheDocument()
    expect(screen.getByText('To Do')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
    expect(screen.getByText('Review')).toBeInTheDocument()
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  it('calls addCard when a card is added through a column', async () => {
    const addCard = vi.fn().mockResolvedValue(undefined)
    mockUseBoard({ addCard })
    render(<Board />)
    const backlog = screen.getAllByTestId('column')[0]
    fireEvent.click(within(backlog).getByRole('button', { name: /add card/i }))
    fireEvent.change(within(backlog).getByPlaceholderText('Card title'), {
      target: { value: 'New task' },
    })
    await act(async () => {
      fireEvent.click(within(backlog).getByRole('button', { name: 'Add Card', exact: true }))
    })
    expect(addCard).toHaveBeenCalledWith('col1', 'New task', '')
  })

  it('calls deleteCard when delete is clicked on a card', async () => {
    const deleteCard = vi.fn().mockResolvedValue(undefined)
    mockUseBoard({ deleteCard })
    render(<Board />)
    const backlog = screen.getAllByTestId('column')[0]
    const card = within(backlog).getByText('Research competitors').closest('[data-testid="card"]')!
    await act(async () => {
      fireEvent.click(within(card as HTMLElement).getByRole('button', { name: /delete card/i }))
    })
    expect(deleteCard).toHaveBeenCalledWith('col1', 'card1')
  })

  it('calls reload on mount', () => {
    const reload = vi.fn().mockResolvedValue(undefined)
    mockUseBoard({ reload })
    render(<Board />)
    expect(reload).toHaveBeenCalled()
  })
})
