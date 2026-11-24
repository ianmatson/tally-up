import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { registerServiceWorker } from '$lib/push'
import { navigate } from '$lib/router.svelte'

registerServiceWorker(navigate)

mount(App, { target: document.getElementById('app')! })

const startup = window as Window & { tallyRecoverStartup?: EventListener }
if (startup.tallyRecoverStartup) removeEventListener('error', startup.tallyRecoverStartup, true)
try {
  sessionStorage.removeItem('tally-up:reloaded')
} catch {}
