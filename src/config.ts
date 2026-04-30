import { loadAmazonCookiesFile } from './utils.js'

const __dirname = new URL('.', import.meta.url).pathname

export const IS_BROWSER_VISIBLE = false

/** Use local mock files instead of live scraping */
export const USE_MOCKS = false

/** Export live scraping HTML to mocks for future use */
export const EXPORT_LIVE_SCRAPING_FOR_MOCKS = true

/**
 * Cookie file path. Defaults to a sibling `amazonCookies.json` in the repo root
 * (the upstream layout). Override via the `AMAZON_COOKIES_FILE_PATH` env var to
 * point at a shared cookies file outside the repo — e.g.,
 * `~/.mcp-credentials/amazon-cookies.json` written to by the MCP Auth Bridge
 * extension. This makes the server hot-swappable: clicking "Save Amazon CA" or
 * "Save Amazon US" in the bridge popup updates that single file, and the next
 * tool call picks up the new marketplace's cookies without a restart.
 */
export const COOKIES_FILE_PATH = process.env.AMAZON_COOKIES_FILE_PATH
  ? process.env.AMAZON_COOKIES_FILE_PATH.replace(/^~/, process.env.HOME ?? '~')
  : `${__dirname}/../amazonCookies.json`

export type AmazonCookie = {
  domain: string
  expirationDate: number
  hostOnly: boolean
  httpOnly: boolean
  name: string
  path: string
  sameSite: 'Strict' | 'Lax' | 'None' | undefined
  secure: boolean
  session: boolean
  storeId: string | null
  value: string
}

/**
 * Read the Amazon cookies file fresh on every call.
 *
 * Upstream loaded cookies once at module-import time, which meant the MCP
 * needed a Claude Desktop restart to pick up new cookies. This function
 * re-reads on every invocation so the user can switch marketplaces (or
 * refresh expired session cookies) by re-clicking "Save" in the auth bridge
 * extension — no restart required.
 *
 * @see https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm
 */
export function getAmazonCookies(): AmazonCookie[] {
  return loadAmazonCookiesFile() as AmazonCookie[]
}

/**
 * Extract the Amazon domain from cookies
 * Returns the domain without the leading dot (e.g., "amazon.com", "amazon.co.uk", "amazon.de")
 */
export function getAmazonDomain(): string {
  const cookies = getAmazonCookies()
  if (!cookies || cookies.length === 0) {
    console.error('[WARN] No cookies found, using default amazon.com domain')
    return 'amazon.com'
  }

  // Find a cookie with domain starting with ".amazon."
  const amazonCookie = cookies.find(cookie =>
    cookie.domain && cookie.domain.startsWith('.amazon.')
  )

  if (amazonCookie) {
    // Remove the leading dot from domain
    const domain = amazonCookie.domain.startsWith('.')
      ? amazonCookie.domain.substring(1)
      : amazonCookie.domain
    console.error(`[INFO] Detected Amazon domain from cookies: ${domain}`)
    return domain
  }

  // Fallback: try to find any cookie with "amazon" in the domain
  const fallbackCookie = cookies.find(cookie =>
    cookie.domain && cookie.domain.includes('amazon')
  )

  if (fallbackCookie) {
    let domain = fallbackCookie.domain
    // Remove leading dot if present
    if (domain.startsWith('.')) {
      domain = domain.substring(1)
    }
    // If it's a subdomain like "www.amazon.com", extract the main domain
    if (domain.startsWith('www.')) {
      domain = domain.substring(4)
    }
    console.error(`[INFO] Detected Amazon domain from cookies (fallback): ${domain}`)
    return domain
  }

  console.error('[WARN] Could not detect Amazon domain from cookies, using default amazon.com')
  return 'amazon.com'
}
