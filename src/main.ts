import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { registerServiceWorker } from '$lib/push'
import { navigate } from '$lib/router.svelte'

registerServiceWorker(navigate)

mount(App, { target: document.getElementById('app')! })
