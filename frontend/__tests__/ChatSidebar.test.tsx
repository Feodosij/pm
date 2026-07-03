import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { ChatSidebar } from '../src/components/ChatSidebar'
import * as api from '../src/lib/api'

vi.mock('../src/lib/api')

const mockApiChat = vi.mocked(api.apiChat)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ChatSidebar', () => {
  it('renders empty state with placeholder text', () => {
    render(<ChatSidebar onBoardUpdate={vi.fn()} />)
    expect(screen.getByTestId('chat-sidebar')).toBeInTheDocument()
    expect(screen.getByText(/ask me to manage your board/i)).toBeInTheDocument()
  })

  it('renders input and send button', () => {
    render(<ChatSidebar onBoardUpdate={vi.fn()} />)
    expect(screen.getByPlaceholderText('Message AI…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
  })

  it('send button is disabled when input is empty', () => {
    render(<ChatSidebar onBoardUpdate={vi.fn()} />)
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
  })

  it('shows user message and AI reply after successful send', async () => {
    mockApiChat.mockResolvedValue({ reply: 'Sure thing!', board_update: null })
    render(<ChatSidebar onBoardUpdate={vi.fn()} />)

    fireEvent.change(screen.getByPlaceholderText('Message AI…'), {
      target: { value: 'Hello' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }))
    })

    await waitFor(() => {
      expect(screen.getByText('Hello')).toBeInTheDocument()
      expect(screen.getByText('Sure thing!')).toBeInTheDocument()
    })
  })

  it('clears input after sending', async () => {
    mockApiChat.mockResolvedValue({ reply: 'Done', board_update: null })
    render(<ChatSidebar onBoardUpdate={vi.fn()} />)
    const textarea = screen.getByPlaceholderText('Message AI…')

    fireEvent.change(textarea, { target: { value: 'hi' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }))
    })

    await waitFor(() => {
      expect((textarea as HTMLTextAreaElement).value).toBe('')
    })
  })

  it('calls onBoardUpdate when board_update is present', async () => {
    const onBoardUpdate = vi.fn()
    mockApiChat.mockResolvedValue({
      reply: 'Moved card.',
      board_update: [{ operation: 'move', card_id: '1', column_id: '5' }],
    })
    render(<ChatSidebar onBoardUpdate={onBoardUpdate} />)

    fireEvent.change(screen.getByPlaceholderText('Message AI…'), {
      target: { value: 'move card 1 to done' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }))
    })

    await waitFor(() => {
      expect(onBoardUpdate).toHaveBeenCalledTimes(1)
    })
  })

  it('does NOT call onBoardUpdate when board_update is null', async () => {
    const onBoardUpdate = vi.fn()
    mockApiChat.mockResolvedValue({ reply: 'Just chatting.', board_update: null })
    render(<ChatSidebar onBoardUpdate={onBoardUpdate} />)

    fireEvent.change(screen.getByPlaceholderText('Message AI…'), {
      target: { value: 'what is this?' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }))
    })

    await waitFor(() => {
      expect(screen.getByText('Just chatting.')).toBeInTheDocument()
    })
    expect(onBoardUpdate).not.toHaveBeenCalled()
  })

  it('shows error alert on failed request', async () => {
    mockApiChat.mockRejectedValue(new Error('Chat request failed'))
    render(<ChatSidebar onBoardUpdate={vi.fn()} />)

    fireEvent.change(screen.getByPlaceholderText('Message AI…'), {
      target: { value: 'hello' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }))
    })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('Chat request failed')).toBeInTheDocument()
    })
  })

  it('sends on Enter key press', async () => {
    mockApiChat.mockResolvedValue({ reply: 'Got it!', board_update: null })
    render(<ChatSidebar onBoardUpdate={vi.fn()} />)

    const textarea = screen.getByPlaceholderText('Message AI…')
    fireEvent.change(textarea, { target: { value: 'hi there' } })
    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    })

    await waitFor(() => {
      expect(mockApiChat).toHaveBeenCalledTimes(1)
    })
  })

  it('does not send on Shift+Enter', async () => {
    render(<ChatSidebar onBoardUpdate={vi.fn()} />)
    const textarea = screen.getByPlaceholderText('Message AI…')
    fireEvent.change(textarea, { target: { value: 'hi' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    expect(mockApiChat).not.toHaveBeenCalled()
  })

  it('passes history to apiChat on second message', async () => {
    mockApiChat
      .mockResolvedValueOnce({ reply: 'First reply', board_update: null })
      .mockResolvedValueOnce({ reply: 'Second reply', board_update: null })
    render(<ChatSidebar onBoardUpdate={vi.fn()} />)

    // Send first message
    fireEvent.change(screen.getByPlaceholderText('Message AI…'), {
      target: { value: 'first' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }))
    })
    await waitFor(() => expect(screen.getByText('First reply')).toBeInTheDocument())

    // Send second message
    fireEvent.change(screen.getByPlaceholderText('Message AI…'), {
      target: { value: 'second' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }))
    })
    await waitFor(() => expect(screen.getByText('Second reply')).toBeInTheDocument())

    // Second call should include history with first exchange
    const secondCallHistory = mockApiChat.mock.calls[1][1]
    expect(secondCallHistory).toContainEqual({ role: 'user', content: 'first' })
    expect(secondCallHistory).toContainEqual({ role: 'assistant', content: 'First reply' })
  })
})
