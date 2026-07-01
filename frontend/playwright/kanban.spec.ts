import { test, expect } from '@playwright/test'

test.describe('Kanban Board', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('renders 5 columns with dummy data', async ({ page }) => {
    const columns = page.locator('[data-testid="column"]')
    await expect(columns).toHaveCount(5)
    const headers = page.locator('[data-testid="column"] > div > button').first()
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
    const finalCount = await page.locator('[data-testid="card"]').count()
    expect(finalCount).toBe(initialCount)
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
