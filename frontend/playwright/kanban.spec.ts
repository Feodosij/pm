import { test, expect } from '@playwright/test'

// Simulate being authenticated so the board is visible without a running backend
async function mockAuthenticated(page: Parameters<typeof test>[1] extends (args: infer A) => unknown ? A extends { page: infer P } ? P : never : never) {
  await page.route('/api/me', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: true, username: 'user' }) })
  )
}

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

test.describe('Kanban Board', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticated(page)
    await page.goto('/')
    await page.waitForSelector('[data-testid="column"]')
  })

  test('renders 5 columns with dummy data', async ({ page }) => {
    const columns = page.locator('[data-testid="column"]')
    await expect(columns).toHaveCount(5)
    await expect(columns.nth(0).getByRole('button', { name: 'Backlog', exact: true })).toBeVisible()
    await expect(columns.nth(1).getByRole('button', { name: 'To Do', exact: true })).toBeVisible()
    await expect(columns.nth(2).getByRole('button', { name: 'In Progress', exact: true })).toBeVisible()
    await expect(columns.nth(3).getByRole('button', { name: 'Review', exact: true })).toBeVisible()
    await expect(columns.nth(4).getByRole('button', { name: 'Done', exact: true })).toBeVisible()
  })

  test('renders dummy cards on load', async ({ page }) => {
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
