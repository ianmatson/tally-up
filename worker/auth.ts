import { decodeIdToken, generateCodeVerifier, generateState, Google } from 'arctic'
import type { Context } from 'hono'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import type { User } from '../shared/api'
import { DAY_MS } from '../shared/dates'

export type AppEnv = { Bindings: Env; Variables: { user: User | null } }

const SESSION_COOKIE = 'session'
const SESSION_TTL_MS = 30 * DAY_MS
const SESSION_RENEW_WITHIN_MS = 15 * DAY_MS
const OAUTH_COOKIE_MAX_AGE_S = 600

type GoogleClaims = { sub: string; email: string; name?: string; picture?: string }

type SessionRow = {
  expires_at: number
  id: string
  name: string
  email: string
  avatar_url: string | null
}

function cookieOptions(c: Context, maxAgeSeconds: number) {
  return {
    path: '/',
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Lax' as const,
    maxAge: maxAgeSeconds,
  }
}

function googleClient(c: Context<AppEnv>) {
  const redirectUri = `${new URL(c.req.url).origin}/auth/google/callback`
  return new Google(c.env.GOOGLE_CLIENT_ID, c.env.GOOGLE_CLIENT_SECRET, redirectUri)
}

function sameOriginUrl(c: Context, next: string | undefined): string {
  const origin = new URL(c.req.url).origin
  const target = new URL(next ?? '/', origin)
  return target.origin === origin ? target.href : `${origin}/`
}

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')

const randomToken = () => toHex(crypto.getRandomValues(new Uint8Array(24)))

async function sessionIdFor(token: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))))
}

export const loadUser = createMiddleware<AppEnv>(async (c, next) => {
  c.set('user', null)
  const token = getCookie(c, SESSION_COOKIE)
  if (token) {
    const sessionId = await sessionIdFor(token)
    const now = Date.now()
    const row = await c.env.DB.prepare(
      `SELECT s.expires_at, u.id, u.name, u.email, u.avatar_url
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > ?`,
    )
      .bind(sessionId, now)
      .first<SessionRow>()
    if (row) {
      c.set('user', { id: row.id, name: row.name, email: row.email, avatarUrl: row.avatar_url })
      if (row.expires_at - now < SESSION_RENEW_WITHIN_MS) {
        await c.env.DB.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').bind(now + SESSION_TTL_MS, sessionId).run()
        setCookie(c, SESSION_COOKIE, token, cookieOptions(c, SESSION_TTL_MS / 1000))
      }
    }
  }
  await next()
})

export const auth = new Hono<AppEnv>()

auth.get('/google', (c) => {
  const state = generateState()
  const verifier = generateCodeVerifier()
  const url = googleClient(c).createAuthorizationURL(state, verifier, ['openid', 'profile', 'email'])
  url.searchParams.set('prompt', 'select_account')
  const options = cookieOptions(c, OAUTH_COOKIE_MAX_AGE_S)
  setCookie(c, 'oauth_state', state, options)
  setCookie(c, 'oauth_verifier', verifier, options)
  setCookie(c, 'oauth_next', sameOriginUrl(c, c.req.query('next')), options)
  return c.redirect(url.toString())
})

auth.get('/google/callback', async (c) => {
  const { code, state } = c.req.query()
  const storedState = getCookie(c, 'oauth_state')
  const verifier = getCookie(c, 'oauth_verifier')
  const next = sameOriginUrl(c, getCookie(c, 'oauth_next'))
  for (const name of ['oauth_state', 'oauth_verifier', 'oauth_next']) deleteCookie(c, name, { path: '/' })

  if (!code || !state || !verifier || state !== storedState) {
    return c.text('Sign-in failed. Go back and try again.', 400)
  }

  let claims: GoogleClaims
  try {
    const tokens = await googleClient(c).validateAuthorizationCode(code, verifier)
    claims = decodeIdToken(tokens.idToken()) as GoogleClaims
  } catch {
    return c.text('Sign-in failed. Go back and try again.', 400)
  }

  const now = Date.now()
  const user = await c.env.DB.prepare(
    `INSERT INTO users (id, google_sub, email, name, avatar_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (google_sub) DO UPDATE SET email = excluded.email, name = excluded.name, avatar_url = excluded.avatar_url
     RETURNING id`,
  )
    .bind(crypto.randomUUID(), claims.sub, claims.email, claims.name ?? 'Tally Up member', claims.picture ?? null, now)
    .first<{ id: string }>()

  const token = randomToken()
  await c.env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(await sessionIdFor(token), user!.id, now + SESSION_TTL_MS)
    .run()
  setCookie(c, SESSION_COOKIE, token, cookieOptions(c, SESSION_TTL_MS / 1000))
  return c.redirect(next)
})

auth.post('/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE)
  if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sessionIdFor(token)).run()
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
  return c.body(null, 204)
})
