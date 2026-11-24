import { DAY_MS } from '../shared/dates'

export const PHOTO_TYPE = 'image/jpeg'
export const PHOTO_MAX_BYTES = 1_000_000
export const PHOTO_PATH = '/api/photos/'
export const PHOTO_LIFETIME_MS = 90 * DAY_MS
const R2_DELETE_LIMIT = 1000

export const ATTACH_PHOTO_SQL = [
  'UPDATE photos SET entry_id = NULL WHERE entry_id = ?2',
  'INSERT INTO photos (key, entry_id, created_at) VALUES (?1, ?2, ?3)',
]
export const DETACH_PHOTO_SQL = 'UPDATE photos SET entry_id = NULL WHERE entry_id = ?'
export const MEMBER_PHOTO_SQL = `SELECT 1 FROM photos p
  JOIN entries e ON e.id = p.entry_id
  JOIN goals go ON go.id = e.goal_id
  JOIN memberships m ON m.group_id = go.group_id AND m.user_id = ?
  WHERE p.key = ?`
export const EXPIRED_PHOTOS_SQL = `SELECT key FROM photos WHERE entry_id IS NULL OR created_at < ? LIMIT ${R2_DELETE_LIMIT}`
export const DELETE_PHOTOS_SQL = 'DELETE FROM photos WHERE key IN (SELECT value FROM json_each(?))'

export async function purgePhotos(env: Env, now = Date.now()) {
  const { results } = await env.DB.prepare(EXPIRED_PHOTOS_SQL).bind(now - PHOTO_LIFETIME_MS).all<{ key: string }>()
  if (results.length === 0) return
  const keys = results.map((row) => row.key)
  await env.PHOTOS.delete(keys)
  await env.DB.prepare(DELETE_PHOTOS_SQL).bind(JSON.stringify(keys)).run()
}
