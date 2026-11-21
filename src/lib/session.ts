import { toast } from 'svelte-sonner'
import { unsubscribeDevice } from './push'

export async function signOut() {
  await unsubscribeDevice().catch(() => {})
  const response = await fetch('/auth/logout', { method: 'POST' }).catch(() => null)
  if (!response?.ok) {
    toast.error('Could not sign out. Try again.')
    return
  }
  window.location.replace('/')
}
