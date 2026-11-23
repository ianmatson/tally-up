<script lang="ts">
  import { mode } from 'mode-watcher'
  import { onMount } from 'svelte'

  type Flake = { x: number; y: number; radius: number; speed: number; phase: number; sway: number; alpha: number }

  const PIXELS_PER_FLAKE = 14_000
  const MAX_FLAKES = 90
  const MAX_FRAME_SECONDS = 0.05
  const SWAY_SPEED = 0.7
  const FLAKE_OUTLINE = 'rgb(120 130 150 / 0.35)'

  let canvas: HTMLCanvasElement

  onMount(() => {
    const context = canvas.getContext('2d')!
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
    let flakes: Flake[] = []
    let width = 0
    let height = 0
    let frame = 0
    let lastTime = 0

    const spawn = (anywhere: boolean): Flake => ({
      x: Math.random() * width,
      y: anywhere ? Math.random() * height : -8,
      radius: 1 + Math.random() * 2,
      speed: 16 + Math.random() * 28,
      phase: Math.random() * Math.PI * 2,
      sway: 6 + Math.random() * 14,
      alpha: 0.35 + Math.random() * 0.5,
    })

    function resize() {
      const ratio = devicePixelRatio || 1
      width = innerWidth
      height = innerHeight
      canvas.width = width * ratio
      canvas.height = height * ratio
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      flakes = Array.from({ length: Math.min(MAX_FLAKES, Math.round((width * height) / PIXELS_PER_FLAKE)) }, () => spawn(true))
      draw()
    }

    function draw() {
      const outlined = mode.current !== 'dark'
      context.clearRect(0, 0, width, height)
      context.strokeStyle = FLAKE_OUTLINE
      context.lineWidth = 0.75
      for (const flake of flakes) {
        context.fillStyle = `rgb(255 255 255 / ${outlined ? 1 : flake.alpha})`
        context.beginPath()
        context.arc(flake.x + Math.sin(flake.phase) * flake.sway, flake.y, flake.radius, 0, Math.PI * 2)
        context.fill()
        if (outlined) context.stroke()
      }
    }

    function tick(time: number) {
      const seconds = Math.min((time - lastTime) / 1000, MAX_FRAME_SECONDS)
      lastTime = time
      for (const [i, flake] of flakes.entries()) {
        flake.y += flake.speed * seconds
        flake.phase += SWAY_SPEED * seconds
        if (flake.y > height + 8) flakes[i] = spawn(false)
      }
      draw()
      frame = requestAnimationFrame(tick)
    }

    function sync() {
      cancelAnimationFrame(frame)
      if (document.hidden || reducedMotion.matches) return draw()
      lastTime = performance.now()
      frame = requestAnimationFrame(tick)
    }

    resize()
    sync()
    addEventListener('resize', resize)
    document.addEventListener('visibilitychange', sync)
    reducedMotion.addEventListener('change', sync)
    return () => {
      cancelAnimationFrame(frame)
      removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', sync)
      reducedMotion.removeEventListener('change', sync)
    }
  })
</script>

<canvas bind:this={canvas} class="pointer-events-none fixed inset-0 -z-10 size-full" aria-hidden="true"></canvas>
