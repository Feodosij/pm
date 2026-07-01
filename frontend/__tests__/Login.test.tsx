import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Login } from '../src/components/Login'
import * as api from '../src/lib/api'

vi.mock('../src/lib/api')

describe('Login', () => {
  const onSuccess = vi.fn()

  beforeEach(() => vi.clearAllMocks())

  it('renders username and password fields', () => {
    render(<Login onSuccess={onSuccess} />)
    expect(screen.getByPlaceholderText('Username')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument()
  })

  it('calls onSuccess after a successful login', async () => {
    vi.mocked(api.login).mockResolvedValue({ ok: true })
    render(<Login onSuccess={onSuccess} />)
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'user' } })
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'password' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
  })

  it('shows an error message on failed login', async () => {
    vi.mocked(api.login).mockRejectedValue(new Error('Invalid credentials'))
    render(<Login onSuccess={onSuccess} />)
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'user' } })
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials'))
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('does not call onSuccess when credentials are empty', async () => {
    render(<Login onSuccess={onSuccess} />)
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
