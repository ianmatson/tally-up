import type { Context, Next } from 'hono'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import { LIMITS } from '../shared/limits'
import { type AppEnv, insertUser, sha256Hex, startSession, userIdByEmail } from './auth'
import { badRequest, parseEmailCode, parseEmailStart } from './validate'

const SENDER = { email: 'login@tally.ianm.app', name: 'Tally Up' }
const CODE_TTL_MS = 10 * 60_000
const RESEND_AFTER_MS = 30_000
const MAX_ATTEMPTS = 5
const LIMIT_WINDOW_MS = 24 * 60 * 60_000
const MAX_SENDS_PER_WINDOW = 8
const MAX_FAILURES_PER_WINDOW = 15
const GLOBAL_SENDS_PER_HOUR = 100
const HOUR_MS = 60 * 60_000

const codeHash = (email: string, code: string) => sha256Hex(`${email}:${code}`)

function newCode(): string {
  const [value] = crypto.getRandomValues(new Uint32Array(1))
  return String(value % 10 ** LIMITS.loginCode).padStart(LIMITS.loginCode, '0')
}

async function assertNotFlooding(c: Context<AppEnv>, next: Next) {
  const { success } = await c.env.LOGIN_RATE_LIMITER.limit({ key: c.req.header('cf-connecting-ip') ?? 'unknown' })
  if (!success) throw new HTTPException(429, { message: 'Too many tries. Wait a minute and try again.' })
  await next()
}

function codeEmail(code: string) {
  return {
    subject: `${code} is your Tally Up code`,
    text: `Your Tally Up sign-in code is ${code}.\n\nIt works for 10 minutes. If you did not ask for it, you can ignore this email.`,
    html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#151515">
  <p style="margin:0 0 16px;font-size:15px">Your Tally Up sign-in code:</p>
  <p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:6px">${code}</p>
  <p style="margin:0;font-size:13px;color:#6b6b6b">It works for 10 minutes. If you did not ask for it, you can ignore this email.</p>
</div>`,
  }
}

const MAX_BODY_BYTES = 1024
const CODE_NO_LONGER_WORKS = 'This code no longer works. Send a new one.'

const PLUS_TAG = /\+.*@/
const DOTLESS_DOMAINS = new Set(['gmail.com', 'googlemail.com'])

function inboxKey(email: string): string {
  const [local, domain] = email.replace(PLUS_TAG, '@').split('@')
  return `${DOTLESS_DOMAINS.has(domain) ? local.replaceAll('.', '') : local}@${domain}`
}

export function purgeExpiredCodes(env: Env) {
  const now = Date.now()
  return env.DB.batch([
    env.DB.prepare('DELETE FROM login_codes WHERE window_start <= ? AND sent_at <= ?').bind(now - LIMIT_WINDOW_MS, now - CODE_TTL_MS),
    env.DB.prepare('DELETE FROM email_budget WHERE hour < ?').bind(Math.floor(now / HOUR_MS)),
  ])
}

async function reserveSend(db: D1Database, now: number): Promise<boolean> {
  const slot = await db
    .prepare('INSERT INTO email_budget (hour, sends) VALUES (?1, 1) ON CONFLICT (hour) DO UPDATE SET sends = sends + 1 WHERE sends < ?2 RETURNING sends')
    .bind(Math.floor(now / HOUR_MS), GLOBAL_SENDS_PER_HOUR)
    .first()
  return slot !== null
}

const blankCode = (db: D1Database, key: string, hash: string) =>
  db.prepare("UPDATE login_codes SET code_hash = '' WHERE email = ? AND code_hash = ?").bind(key, hash).run()

export const emailAuth = new Hono<AppEnv>()

emailAuth.use(assertNotFlooding, bodyLimit({ maxSize: MAX_BODY_BYTES, onError: () => badRequest('Request too large') }))

emailAuth.post('/start', async (c) => {
  const email = parseEmailStart(await c.req.json())
  const key = inboxKey(email)
  const now = Date.now()
  const code = newCode()
  const hash = await codeHash(email, code)
  const newWindow = 'login_codes.window_start <= ?3 - ?5'
  const stored = await c.env.DB.prepare(
    `INSERT INTO login_codes (email, code_hash, sent_at, attempts, window_start, sends, failures) VALUES (?1, ?2, ?3, 0, ?3, 1, 0)
     ON CONFLICT (email) DO UPDATE SET code_hash = excluded.code_hash, sent_at = excluded.sent_at, attempts = 0,
       window_start = CASE WHEN ${newWindow} THEN ?3 ELSE login_codes.window_start END,
       sends = CASE WHEN ${newWindow} THEN 1 ELSE login_codes.sends + 1 END,
       failures = CASE WHEN ${newWindow} THEN 0 ELSE login_codes.failures END
     WHERE login_codes.sent_at <= ?3 - ?4 AND (${newWindow} OR (login_codes.sends < ?6 AND login_codes.failures < ?7))
     RETURNING email`,
  )
    .bind(key, hash, now, RESEND_AFTER_MS, LIMIT_WINDOW_MS, MAX_SENDS_PER_WINDOW, MAX_FAILURES_PER_WINDOW)
    .first()
  if (!stored) throw new HTTPException(429, { message: 'A code was sent to this email recently. Wait a bit and try again, or continue with Google.' })
  if (!(await reserveSend(c.env.DB, now))) {
    await blankCode(c.env.DB, key, hash)
    throw new HTTPException(429, { message: 'Email sign-in is busy right now. Try again later, or continue with Google.' })
  }
  try {
    await c.env.EMAIL.send({ to: email, from: SENDER, ...codeEmail(code) })
  } catch (error) {
    console.error('Login code email failed', error)
    await blankCode(c.env.DB, key, hash)
    throw new HTTPException(502, { message: 'Could not send the code. Check the address and try again.' })
  }
  return c.body(null, 204)
})

emailAuth.post('/verify', async (c) => {
  const { email, code } = parseEmailCode(await c.req.json())
  const attempt = await c.env.DB.prepare(
    `UPDATE login_codes SET attempts = attempts + 1, failures = failures + 1
     WHERE email = ? AND code_hash != '' AND attempts < ? AND failures < ? AND sent_at > ? RETURNING code_hash`,
  )
    .bind(inboxKey(email), MAX_ATTEMPTS, MAX_FAILURES_PER_WINDOW, Date.now() - CODE_TTL_MS)
    .first<{ code_hash: string }>()
  if (!attempt) badRequest(CODE_NO_LONGER_WORKS)
  const hash = await codeHash(email, code)
  if (attempt.code_hash !== hash) badRequest('That code is not right. Check the email and try again.')
  const used = await c.env.DB.prepare(
    "UPDATE login_codes SET code_hash = '', failures = failures - 1 WHERE email = ? AND code_hash = ? RETURNING email",
  )
    .bind(inboxKey(email), hash)
    .first()
  if (!used) badRequest(CODE_NO_LONGER_WORKS)
  await startSession(c, (await userIdByEmail(c.env.DB, email)) ?? (await insertUser(c.env.DB, { email })))
  return c.body(null, 204)
})
