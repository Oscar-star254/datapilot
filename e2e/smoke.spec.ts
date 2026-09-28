import { test, expect } from '@playwright/test'
import path from 'path'

const BASE = process.env.FRONTEND_URL || 'http://localhost:5173'
const API = process.env.BACKEND_URL || 'http://localhost:8000'
const EMAIL = process.env.TEST_EMAIL || 'smoke@datapilot.test'
const PASSWORD = process.env.TEST_PASSWORD || 'Smoke1234!'

test.describe('DataPilot smoke tests', () => {
  test('backend health check', async ({ request }) => {
    const res = await request.get(`${API}/health`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })

  test('login page loads', async ({ page }) => {
    await page.goto(`${BASE}/auth/login`)
    await expect(page.getByText('Welcome back')).toBeVisible({ timeout: 10000 })
    await expect(page.getByPlaceholder('you@company.com')).toBeVisible()
  })

  test('signup page loads', async ({ page }) => {
    await page.goto(`${BASE}/auth/signup`)
    await expect(page.getByText('Create your account')).toBeVisible()
  })

  test('unauthenticated user redirected to login', async ({ page }) => {
    await page.goto(`${BASE}/app/datasets`)
    await expect(page).toHaveURL(/auth\/login/)
  })

  test('sign in and reach datasets page', async ({ page }) => {
    await page.goto(`${BASE}/auth/login`)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(/app\/datasets/, { timeout: 15000 })
    await expect(page.getByText('Datasets')).toBeVisible()
  })

  test('upload a CSV dataset', async ({ page }) => {
    await page.goto(`${BASE}/auth/login`)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(/app\/datasets/, { timeout: 15000 })

    // Create a small CSV
    const csv = 'name,age,score\nAlice,30,85.5\nBob,25,92.1\nCarol,35,78.3\n'
    const buf = Buffer.from(csv)

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'smoke_test.csv',
      mimeType: 'text/csv',
      buffer: buf,
    })

    // Wait for upload to start
    await expect(page.getByText(/Processing|Profiling|uploading/i)).toBeVisible({ timeout: 5000 })
  })

  test('navigation between sections works', async ({ page }) => {
    await page.goto(`${BASE}/auth/login`)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(/app\/datasets/, { timeout: 15000 })

    for (const [label, path] of [
      ['Viewer', '/app/viewer'],
      ['Cleaning', '/app/cleaning'],
      ['Statistics', '/app/statistics'],
      ['Visualization', '/app/visualization'],
      ['Dashboards', '/app/dashboards'],
      ['SQL Playground', '/app/sql'],
    ]) {
      await page.getByText(label).first().click()
      await expect(page).toHaveURL(new RegExp(path.replace('/', '\\/').replace('/', '\\/')))
    }
  })
})
