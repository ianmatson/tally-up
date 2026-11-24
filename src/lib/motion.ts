import { cubicOut } from 'svelte/easing'
import { slide } from 'svelte/transition'

const EXPAND_MS = 240
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

export const expand = (node: Element) => slide(node, { duration: reducedMotion.matches ? 0 : EXPAND_MS, easing: cubicOut })
