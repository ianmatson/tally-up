type InstallPromptEvent = Event & { prompt: () => Promise<void> }

export type Platform = 'ios' | 'android' | 'other'

const TIP_DISMISSED_KEY = 'tally-up:install-tip-dismissed'

const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export const platform: Platform = isIos ? 'ios' : /Android/i.test(navigator.userAgent) ? 'android' : 'other'

export const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && navigator.standalone === true)

function readTipDismissed(): boolean {
  try {
    return localStorage.getItem(TIP_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

class InstallState {
  promptEvent = $state<InstallPromptEvent | null>(null)
  tipDismissed = $state(readTipDismissed())

  get showTip() {
    return platform !== 'other' && !isStandalone && !this.tipDismissed
  }

  async promptInstall() {
    await this.promptEvent?.prompt()
    this.promptEvent = null
  }

  dismissTip() {
    this.tipDismissed = true
    try {
      localStorage.setItem(TIP_DISMISSED_KEY, '1')
    } catch {}
  }
}

export const install = new InstallState()

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  install.promptEvent = event as InstallPromptEvent
})
window.addEventListener('appinstalled', () => (install.promptEvent = null))
