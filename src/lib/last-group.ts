const STORAGE_KEY = 'tally-up:last-group'

export function readLastGroup(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function rememberLastGroup(groupId: string) {
  try {
    localStorage.setItem(STORAGE_KEY, groupId)
  } catch {}
}
