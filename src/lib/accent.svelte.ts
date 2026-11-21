export const ACCENTS = [
  { name: 'Highlighter', value: '#f1f36e' },
  { name: 'Lime', value: '#c5ef6b' },
  { name: 'Mint', value: '#8eecc0' },
  { name: 'Sky', value: '#94d4fb' },
  { name: 'Lavender', value: '#c8bafc' },
  { name: 'Pink', value: '#fbb4d6' },
  { name: 'Peach', value: '#fdc08f' },
  { name: 'Coral', value: '#fb9f8d' },
] as const

const STORAGE_KEY = 'tally-up:accent'
const DEFAULT_ACCENT = ACCENTS[0].value

function readAccent(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return ACCENTS.some((a) => a.value === stored) ? stored! : DEFAULT_ACCENT
  } catch {
    return DEFAULT_ACCENT
  }
}

class AccentStore {
  current = $state(readAccent())

  set(value: string) {
    this.current = value
    document.documentElement.style.setProperty('--highlight', value)
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {}
  }
}

export const accent = new AccentStore()
