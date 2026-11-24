import { cubicOut } from 'svelte/easing'
import { slide } from 'svelte/transition'

const EXPAND_MS = 240
export const MOVE_MS = 200
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

export const prefersReducedMotion = () => reducedMotion.matches

export const expand = (node: Element) => slide(node, { duration: prefersReducedMotion() ? 0 : EXPAND_MS, easing: cubicOut })
