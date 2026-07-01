import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AddCardForm } from '../src/components/AddCardForm'

function renderForm(onAdd = vi.fn(), onClose = vi.fn()) {
  render(<AddCardForm columnId="col1" onAdd={onAdd} onClose={onClose} />)
  return { onAdd, onClose }
}

describe('AddCardForm', () => {
  it('renders title and details inputs', () => {
    renderForm()
    expect(screen.getByPlaceholderText('Card title')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Details (optional)')).toBeInTheDocument()
  })

  it('calls onAdd with title and details on submit', () => {
    const { onAdd } = renderForm()
    fireEvent.change(screen.getByPlaceholderText('Card title'), { target: { value: 'My Card' } })
    fireEvent.change(screen.getByPlaceholderText('Details (optional)'), { target: { value: 'My details' } })
    fireEvent.click(screen.getByRole('button', { name: /add card/i }))
    expect(onAdd).toHaveBeenCalledWith('col1', 'My Card', 'My details')
  })

  it('does not call onAdd when title is empty', () => {
    const { onAdd } = renderForm()
    fireEvent.click(screen.getByRole('button', { name: /add card/i }))
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('calls onClose when Cancel is clicked', () => {
    const { onClose } = renderForm()
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
