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
