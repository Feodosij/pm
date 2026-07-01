import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Page from '../src/app/page'
import * as api from '../src/lib/api'

vi.mock('../src/lib/api')
vi.mock('../src/components/Board', () => ({ Board: () => <div data-testid="board" /> }))
vi.mock('../src/components/Login', () => ({
  Login: ({ onSuccess }: { onSuccess: () => void }) => (
    <button data-testid="login-trigger" onClick={onSuccess}>mock-login</button>
  ),
}))

describe('Home page auth gate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the board when authenticated', async () => {
    vi.mocked(api.fetchMe).mockResolvedValue({ authenticated: true, username: 'user' })
    render(<Page />)
    await waitFor(() => expect(screen.getByTestId('board')).toBeInTheDocument())
  })

  it('shows the login form when unauthenticated', async () => {
    vi.mocked(api.fetchMe).mockResolvedValue({ authenticated: false })
    render(<Page />)
    await waitFor(() => expect(screen.getByTestId('login-trigger')).toBeInTheDocument())
  })

  it('shows the board after onSuccess from login', async () => {
    vi.mocked(api.fetchMe).mockResolvedValue({ authenticated: false })
    render(<Page />)
    await waitFor(() => expect(screen.getByTestId('login-trigger')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('login-trigger'))
    expect(screen.getByTestId('board')).toBeInTheDocument()
  })

  it('shows the login form after sign-out', async () => {
    vi.mocked(api.fetchMe).mockResolvedValue({ authenticated: true, username: 'user' })
    vi.mocked(api.logout).mockResolvedValue(undefined)
    render(<Page />)
    await waitFor(() => expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))
    await waitFor(() => expect(screen.getByTestId('login-trigger')).toBeInTheDocument())
  })
})
