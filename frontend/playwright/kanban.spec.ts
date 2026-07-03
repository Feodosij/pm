import { test, expect, type Page } from '@playwright/test'

// Demo board matching the seed data
const seedBoard = {
  id: '1',
  title: 'My Board',
  columns: [
    {
      id: '1',
      title: 'Backlog',
      cards: [
        { id: '1', title: 'Research competitors',  details: 'Analyze top 5 competitors and document their key features.' },
        { id: '2', title: 'Define MVP scope',      details: 'Work with stakeholders to finalize the feature set for v1.' },
        { id: '3', title: 'Design system audit',   details: 'Review existing design tokens and identify inconsistencies.' },
      ],
    },
    {
      id: '2',
      title: 'To Do',
      cards: [
        { id: '4', title: 'Set up CI/CD pipeline',   details: 'Configure GitHub Actions for automated testing and deployment.' },
        { id: '5', title: 'Write API documentation',  details: 'Document all REST endpoints using OpenAPI 3.0 spec.' },
      ],
    },
    { id: '3', title: 'In Progress', cards: [
      { id: '6', title: 'Implement auth flow',    details: 'Build login, register, and password reset screens.' },
      { id: '7', title: 'Database schema design', details: 'Finalize ERD and write migration scripts.' },
    ]},
    { id: '4', title: 'Review', cards: [
      { id: '8', title: 'Landing page redesign', details: 'New hero section with improved conversion copy.' },
    ]},
    { id: '5', title: 'Done', cards: [
      { id: '9',  title: 'Project kickoff',   details: 'Initial team alignment meeting completed.' },
      { id: '10', title: 'Tech stack decision', details: 'Agreed on Next.js, TypeScript, and Tailwind CSS.' },
    ]},
  ],
}

type BoardData = typeof seedBoard

/** Set up all API mocks with a stateful in-memory board so mutations persist within a test. */
async function setupMocks(page: Page, authenticated = true) {
  let board: BoardData = JSON.parse(JSON.stringify(seedBoard))
  let nextId = 100

  await page.route('/api/me', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated, username: 'user' }) })
  )

  await page.route('/api/board', route => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(board) })
  })

  await page.route('/api/board/cards', async route => {
    const body = route.request().postDataJSON()
    const col = board.columns.find(c => c.id === body.column_id)
    if (!col) { route.fulfill({ status: 404 }); return }
    const card = { id: String(nextId++), title: body.title, details: body.details ?? '' }
    col.cards.push(card)
    route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(card) })
  })

  await page.route('/api/board/cards/**', async route => {
    const method = route.request().method()
    const url = route.request().url()
    const cardId = url.split('/').pop()!

    if (method === 'DELETE') {
      for (const col of board.columns) {
        const idx = col.cards.findIndex(c => c.id === cardId)
        if (idx !== -1) { col.cards.splice(idx, 1); break }
      }
      route.fulfill({ status: 204 })
      return
    }

    if (method === 'PATCH') {
      const body = route.request().postDataJSON()
      for (const col of board.columns) {
        const card = col.cards.find(c => c.id === cardId)
        if (card) {
          if (body.title !== undefined) card.title = body.title
          if (body.details !== undefined) card.details = body.details
          if (body.column_id !== undefined && body.position !== undefined) {
            col.cards = col.cards.filter(c => c.id !== cardId)
            const destCol = board.columns.find(c => c.id === body.column_id)!
            destCol.cards.splice(body.position, 0, card)
          }
          route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(card) })
          return
        }
      }
      route.fulfill({ status: 404 }); return
    }
  })

  await page.route('/api/board/columns/**', async route => {
    const url = route.request().url()
    const colId = url.split('/').pop()!
    const body = route.request().postDataJSON()
    const col = board.columns.find(c => c.id === colId)
    if (!col) { route.fulfill({ status: 404 }); return }
    col.title = body.title
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(col) })
  })

  return { getBoard: () => board }
}

// ── Authentication ─────────────────────────────────────────────────────────────

test.describe('Authentication', () => {
  test('shows the login screen when unauthenticated', async ({ page }) => {
    await page.route('/api/me', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: false }) })
    )
    await page.goto('/')
    await expect(page.getByPlaceholder('Username')).toBeVisible()
    await expect(page.getByPlaceholder('Password')).toBeVisible()
  })

  test('logs in and shows the board', async ({ page }) => {
    let authenticated = false
    await page.route('/api/me', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(authenticated ? { authenticated: true, username: 'user' } : { authenticated: false }),
      })
    )
    await page.route('/api/login', async route => {
      const body = route.request().postDataJSON()
      if (body.username === 'user' && body.password === 'password') {
        authenticated = true
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
      } else {
        await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'Invalid credentials' }) })
      }
    })
    await page.route('/api/board', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(seedBoard) })
    )
    await page.goto('/')
    await page.getByPlaceholder('Username').fill('user')
    await page.getByPlaceholder('Password').fill('password')
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page.locator('[data-testid="column"]').first()).toBeVisible()
  })

  test('shows an error on wrong credentials', async ({ page }) => {
    await page.route('/api/me', async route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: false }) })
    )
    await page.route('/api/login', async route =>
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'Invalid credentials' }) })
    )
    await page.goto('/')
    await page.waitForSelector('input[placeholder="Username"]')
    await page.getByPlaceholder('Username').fill('user')
    await page.getByPlaceholder('Password').fill('wrong')
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page.locator('p[role="alert"]')).toBeVisible({ timeout: 10000 })
  })

  test('logs out and returns to the login screen', async ({ page }) => {
    let authenticated = true
    await page.route('/api/me', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(authenticated ? { authenticated: true, username: 'user' } : { authenticated: false }),
      })
    )
    await page.route('/api/board', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(seedBoard) })
    )
    await page.route('/api/logout', async route => {
      authenticated = false
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    })
    await page.goto('/')
    await page.waitForSelector('[data-testid="column"]')
    await page.getByRole('button', { name: /sign out/i }).click()
    await expect(page.getByPlaceholder('Username')).toBeVisible()
  })
})

// ── Kanban Board ───────────────────────────────────────────────────────────────

test.describe('Kanban Board', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page)
    await page.goto('/')
    await page.waitForSelector('[data-testid="column"]')
  })

  test('renders 5 columns with seeded data', async ({ page }) => {
    const columns = page.locator('[data-testid="column"]')
    await expect(columns).toHaveCount(5)
    await expect(columns.nth(0).getByRole('button', { name: 'Backlog', exact: true })).toBeVisible()
    await expect(columns.nth(1).getByRole('button', { name: 'To Do', exact: true })).toBeVisible()
    await expect(columns.nth(2).getByRole('button', { name: 'In Progress', exact: true })).toBeVisible()
    await expect(columns.nth(3).getByRole('button', { name: 'Review', exact: true })).toBeVisible()
    await expect(columns.nth(4).getByRole('button', { name: 'Done', exact: true })).toBeVisible()
  })

  test('renders seeded cards on load', async ({ page }) => {
    await expect(page.locator('text=Research competitors')).toBeVisible()
    await expect(page.locator('text=Project kickoff')).toBeVisible()
  })

  test('can rename a column', async ({ page }) => {
    await page.locator('[data-testid="column"]').first().getByRole('button').first().click()
    const input = page.locator('[data-testid="column"]').first().locator('input')
    await input.fill('Sprint 1')
    await input.press('Enter')
    await expect(page.locator('text=Sprint 1')).toBeVisible()
  })

  test('can cancel column rename with Escape', async ({ page }) => {
    await page.locator('[data-testid="column"]').first().getByRole('button').first().click()
    const input = page.locator('[data-testid="column"]').first().locator('input')
    await input.fill('Should not save')
    await input.press('Escape')
    await expect(page.locator('text=Backlog')).toBeVisible()
    await expect(page.locator('text=Should not save')).not.toBeVisible()
  })

  test('can add a card to a column', async ({ page }) => {
    await page.locator('[data-testid="column"]').first().getByRole('button', { name: /add card/i }).click()
    await page.locator('input[placeholder="Card title"]').fill('My new card')
    await page.locator('textarea[placeholder="Details (optional)"]').fill('Some details')
    await page.getByRole('button', { name: 'Add Card', exact: true }).click()
    await expect(page.locator('text=My new card')).toBeVisible()
  })

  test('does not add a card when title is empty', async ({ page }) => {
    const initialCount = await page.locator('[data-testid="card"]').count()
    await page.locator('[data-testid="column"]').first().getByRole('button', { name: /add card/i }).click()
    await page.getByRole('button', { name: 'Add Card', exact: true }).click()
    expect(await page.locator('[data-testid="card"]').count()).toBe(initialCount)
  })

  test('can cancel adding a card', async ({ page }) => {
    await page.locator('[data-testid="column"]').first().getByRole('button', { name: /add card/i }).click()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.locator('input[placeholder="Card title"]')).not.toBeVisible()
  })

  test('can delete a card', async ({ page }) => {
    const card = page.locator('[data-testid="card"]').first()
    await card.hover()
    await card.getByRole('button', { name: /delete card/i }).click({ force: true })
    await expect(page.locator('text=Research competitors')).not.toBeVisible()
  })

  test('can edit a card inline', async ({ page }) => {
    const card = page.locator('[data-testid="card"]').first()
    await card.hover()
    await card.getByRole('button', { name: /edit card/i }).click({ force: true })
    const titleInput = page.getByTestId('card-title-input')
    await titleInput.fill('Updated task title')
    await titleInput.press('Enter')
    await expect(page.locator('text=Updated task title')).toBeVisible()
  })

  test('add a card, then reload — change persists via mock state', async ({ page }) => {
    // Add a card
    await page.locator('[data-testid="column"]').first().getByRole('button', { name: /add card/i }).click()
    await page.locator('input[placeholder="Card title"]').fill('Persisted card')
    await page.getByRole('button', { name: 'Add Card', exact: true }).click()
    await expect(page.locator('text=Persisted card')).toBeVisible()

    // Reload — the stateful mock returns the updated board
    await page.reload()
    await page.waitForSelector('[data-testid="column"]')
    await expect(page.locator('text=Persisted card')).toBeVisible()
  })

  test('can drag a card to another column', async ({ page }) => {
    const sourceCard = page.locator('[data-testid="card"]').first()
    const destColumn = page.locator('[data-testid="column"]').nth(1)
    const sourceBox = await sourceCard.boundingBox()
    const destBox = await destColumn.boundingBox()
    if (!sourceBox || !destBox) throw new Error('Elements not found')
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(200)
    await page.mouse.move(destBox.x + destBox.width / 2, destBox.y + destBox.height / 2, { steps: 20 })
    await page.mouse.up()
    await page.waitForTimeout(300)
    await expect(destColumn.locator('text=Research competitors')).toBeVisible()
  })
})

// ── AI Chat Sidebar ────────────────────────────────────────────────────────────

test.describe('AI Chat Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page)
    await page.goto('/')
    await page.waitForSelector('[data-testid="column"]')
  })

  test('AI toggle button is visible in header', async ({ page }) => {
    await expect(page.getByRole('button', { name: /toggle ai chat/i })).toBeVisible()
  })

  test('clicking AI button opens and closes the chat sidebar', async ({ page }) => {
    const toggle = page.getByRole('button', { name: /toggle ai chat/i })
    await toggle.click()
    await expect(page.getByTestId('chat-sidebar')).toBeVisible()
    await toggle.click()
    await expect(page.getByTestId('chat-sidebar')).not.toBeVisible()
  })

  test('chat sidebar shows empty state hint and input', async ({ page }) => {
    await page.getByRole('button', { name: /toggle ai chat/i }).click()
    await expect(page.getByTestId('chat-sidebar')).toBeVisible()
    await expect(page.getByPlaceholder('Message AI…')).toBeVisible()
    await expect(page.getByRole('button', { name: /send/i })).toBeVisible()
  })

  test('sends a message and shows AI reply, triggers board reload on board_update', async ({ page }) => {
    // Mock the chat endpoint: returns a board_update so the board reloads
    let boardReloads = 0
    await page.route('/api/board', async route => {
      boardReloads++
      await route.continue()
    })
    await page.route('/api/chat', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          reply: 'Moved the card to Done!',
          board_update: [{ operation: 'move', card_id: '1', column_id: '5' }],
        }),
      })
    })

    const initialReloads = boardReloads
    await page.getByRole('button', { name: /toggle ai chat/i }).click()
    await page.getByPlaceholder('Message AI…').fill('Move Research competitors to Done')
    await page.getByRole('button', { name: /send/i }).click()

    await expect(page.getByText('Move Research competitors to Done')).toBeVisible()
    await expect(page.getByText('Moved the card to Done!')).toBeVisible({ timeout: 10000 })
    // Board should have been reloaded because board_update was non-null
    expect(boardReloads).toBeGreaterThan(initialReloads)
  })

  test('shows error message on failed chat request', async ({ page }) => {
    await page.route('/api/chat', route =>
      route.fulfill({ status: 500, body: 'Internal Server Error' })
    )
    await page.getByRole('button', { name: /toggle ai chat/i }).click()
    await page.getByPlaceholder('Message AI…').fill('hello')
    await page.getByRole('button', { name: /send/i }).click()
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10000 })
  })
})
