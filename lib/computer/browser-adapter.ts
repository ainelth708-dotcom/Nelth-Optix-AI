import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { isUrlAllowed } from './security'
import { BrowserElementRef, BrowserSnapshot } from './types'

export interface BrowserActionResult {
  success: boolean
  url: string
  title: string
  screenshot?: string
  text?: string
  error?: string
}

export class BrowserAdapter {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private page: Page | null = null
  private snapshotCounter = 0
  private lastSnapshotElements: BrowserElementRef[] = []

  constructor(public readonly userId: string) {}

  private async ensurePage(): Promise<Page> {
    if (this.page && !this.page.isClosed()) {
      return this.page
    }

    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--window-size=1280,800'
        ]
      })
    }

    if (!this.context) {
      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 NelthComputerAgent/1.0'
      })
    }

    this.page = await this.context.newPage()
    this.page.setDefaultTimeout(20000)
    return this.page
  }

  async navigate(url: string): Promise<BrowserActionResult> {
    const allowedCheck = isUrlAllowed(url)
    if (!allowedCheck.allowed) {
      throw new Error(allowedCheck.reason || 'URL non autorisée.')
    }

    const page = await this.ensurePage()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(1000)

    const title = await page.title().catch(() => '')
    const currentUrl = page.url()
    const screenshot = await this.takeScreenshot()

    return {
      success: true,
      url: currentUrl,
      title,
      screenshot
    }
  }

  async read(maxLength = 10000): Promise<{ title: string; url: string; text: string }> {
    const page = await this.ensurePage()
    const title = await page.title().catch(() => '')
    const url = page.url()

    const pageText = await page.evaluate(() => {
      // Clean script, style, and hidden elements
      const clone = document.body.cloneNode(true) as HTMLElement
      const removeElements = clone.querySelectorAll('script, style, noscript, svg')
      removeElements.forEach(el => el.remove())
      return (clone.innerText || clone.textContent || '').replace(/\s+/g, ' ').trim()
    })

    return {
      title,
      url,
      text: pageText.slice(0, maxLength)
    }
  }

  async snapshot(includeScreenshot = true): Promise<BrowserSnapshot> {
    const page = await this.ensurePage()
    this.snapshotCounter += 1
    const snapshotId = this.snapshotCounter
    const title = await page.title().catch(() => '')
    const url = page.url()

    // Find interactive elements and assign unique refs for the agent
    const elements: BrowserElementRef[] = await page.evaluate(() => {
      const results: BrowserElementRef[] = []
      const candidates = document.querySelectorAll(
        'button, a[href], input, textarea, select, [role="button"], [role="link"], [role="checkbox"]'
      )

      let count = 0
      candidates.forEach(el => {
        const rect = el.getBoundingClientRect()
        // Only visible elements
        if (rect.width <= 0 || rect.height <= 0 || window.getComputedStyle(el).display === 'none') return

        count++
        const ref = `el-${count}`
        el.setAttribute('data-nelth-ref', ref)

        const text = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80)
        const tag = el.tagName.toLowerCase()
        const placeholder = el.getAttribute('placeholder') || undefined
        const ariaLabel = el.getAttribute('aria-label') || undefined
        const href = el.getAttribute('href') || undefined
        const role = el.getAttribute('role') || undefined

        results.push({
          ref,
          tag,
          text: text || undefined,
          role,
          placeholder,
          ariaLabel,
          href
        })
      })

      return results.slice(0, 100) // Keep top 100 actionable elements
    })

    this.lastSnapshotElements = elements

    const { text } = await this.read(4000)
    let screenshot: string | undefined
    if (includeScreenshot) {
      screenshot = await this.takeScreenshot()
    }

    return {
      snapshotId,
      url,
      title,
      elements,
      textSummary: text,
      screenshot
    }
  }

  async click(ref: string): Promise<BrowserActionResult> {
    const page = await this.ensurePage()
    const selector = `[data-nelth-ref="${ref}"]`

    const element = await page.$(selector)
    if (!element) {
      throw new Error(`Element avec ref "${ref}" introuvable. Prenez un nouveau snapshot pour rafraîchir les éléments.`)
    }

    await element.click({ timeout: 10000 })
    await page.waitForTimeout(1000)

    const title = await page.title().catch(() => '')
    const url = page.url()
    const screenshot = await this.takeScreenshot()

    return {
      success: true,
      url,
      title,
      screenshot
    }
  }

  async type(ref: string, text: string, submit = false): Promise<BrowserActionResult> {
    const page = await this.ensurePage()
    const selector = `[data-nelth-ref="${ref}"]`

    const element = await page.$(selector)
    if (!element) {
      throw new Error(`Champ avec ref "${ref}" introuvable. Prenez un snapshot pour rafraîchir.`)
    }

    await element.fill(text, { timeout: 10000 })
    if (submit) {
      await element.press('Enter')
      await page.waitForTimeout(1000)
    }

    const title = await page.title().catch(() => '')
    const url = page.url()
    const screenshot = await this.takeScreenshot()

    return {
      success: true,
      url,
      title,
      screenshot
    }
  }

  async pressKey(key: string): Promise<BrowserActionResult> {
    const page = await this.ensurePage()
    await page.keyboard.press(key)
    await page.waitForTimeout(500)

    const title = await page.title().catch(() => '')
    const url = page.url()
    const screenshot = await this.takeScreenshot()

    return {
      success: true,
      url,
      title,
      screenshot
    }
  }

  async scroll(deltaY: number): Promise<BrowserActionResult> {
    const page = await this.ensurePage()
    await page.mouse.wheel(0, deltaY)
    await page.waitForTimeout(500)

    const title = await page.title().catch(() => '')
    const url = page.url()
    const screenshot = await this.takeScreenshot()

    return {
      success: true,
      url,
      title,
      screenshot
    }
  }

  async takeScreenshot(fullPage = false): Promise<string> {
    const page = await this.ensurePage()
    const buffer = await page.screenshot({
      type: 'jpeg',
      quality: 80,
      fullPage
    })
    return `data:image/jpeg;base64,${buffer.toString('base64')}`
  }

  async close(): Promise<void> {
    if (this.page) {
      await this.page.close().catch(() => null)
      this.page = null
    }
    if (this.context) {
      await this.context.close().catch(() => null)
      this.context = null
    }
    if (this.browser) {
      await this.browser.close().catch(() => null)
      this.browser = null
    }
  }
}

// Memory pool of browser adapters per user
const browserPool = new Map<string, BrowserAdapter>()

export function getBrowserForUser(userId: string): BrowserAdapter {
  let adapter = browserPool.get(userId)
  if (!adapter) {
    adapter = new BrowserAdapter(userId)
    browserPool.set(userId, adapter)
  }
  return adapter
}
