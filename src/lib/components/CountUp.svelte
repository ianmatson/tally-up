<script lang="ts">
  import { untrack } from 'svelte'

  let { value, format }: { value: number; format: (n: number) => string } = $props()

  const DURATION_MS = 700
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  let shown = $state(reducedMotion ? untrack(() => value) : 0)

  $effect(() => {
    const target = value
    if (reducedMotion) {
      shown = target
      return
    }
    const from = untrack(() => shown)
    const start = performance.now()
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start) / DURATION_MS)
      shown = from + (target - from) * (1 - Math.pow(1 - t, 4))
      if (t < 1) frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  })
</script>

<span class="tabular">{format(shown)}</span>
