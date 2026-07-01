import type { BoardState, Card } from './types'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

export async function fetchMe(): Promise<{ authenticated: boolean; username?: string }> {
  const res = await fetch(`${BASE}/api/me`, { credentials: 'include' })
  return res.json()
}

export async function login(username: string, password: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) throw new Error('Invalid credentials')
  return res.json()
}

export async function logout(): Promise<void> {
  await fetch(`${BASE}/api/logout`, { method: 'POST', credentials: 'include' })
}

export async function fetchBoard(): Promise<BoardState> {
  const res = await fetch(`${BASE}/api/board`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to load board')
  return res.json()
}

export async function apiCreateCard(columnId: string, title: string, details: string): Promise<Card> {
  const res = await fetch(`${BASE}/api/board/cards`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ column_id: columnId, title, details }),
  })
  if (!res.ok) throw new Error('Failed to create card')
  return res.json()
}

export async function apiEditCard(cardId: string, title: string, details: string): Promise<Card> {
  const res = await fetch(`${BASE}/api/board/cards/${cardId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, details }),
  })
  if (!res.ok) throw new Error('Failed to edit card')
  return res.json()
}

export async function apiMoveCard(
  cardId: string,
  destColumnId: string,
  destIndex: number
): Promise<Card> {
  const res = await fetch(`${BASE}/api/board/cards/${cardId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ column_id: destColumnId, position: destIndex }),
  })
  if (!res.ok) throw new Error('Failed to move card')
  return res.json()
}

export async function apiDeleteCard(cardId: string): Promise<void> {
  const res = await fetch(`${BASE}/api/board/cards/${cardId}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Failed to delete card')
}

export async function apiRenameColumn(columnId: string, title: string): Promise<void> {
  const res = await fetch(`${BASE}/api/board/columns/${columnId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (!res.ok) throw new Error('Failed to rename column')
}
