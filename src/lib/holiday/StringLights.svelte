<script lang="ts">
  import { mode } from 'mode-watcher'

  const SWAG_WIDTH = 40
  const SAG = 3
  const WIRE_TOP = 1
  const BULB_STOPS = [0.125, 0.375, 0.625, 0.875]
  const COLORS = ['#e5484d', '#ffc53d', '#30a46c', '#3e8ef7']
  const TILT = 0.8
  const JITTER_DEGREES = 14
  const WIRE_GREEN = { light: '#2f5240', dark: '#5b7f66' }
  const BULB_PATH = 'M-1.1 0V2.6Q-1.1 4.4 0 6.2Q1.1 4.4 1.1 2.6V0Z'

  let width = $state(0)
  const swags = $derived(Math.ceil(width / SWAG_WIDTH))
  const wire = $derived(
    `M0 ${WIRE_TOP}` +
      Array.from({ length: swags }, (_, i) => ` Q${(i + 0.5) * SWAG_WIDTH} ${WIRE_TOP + 2 * SAG} ${(i + 1) * SWAG_WIDTH} ${WIRE_TOP}`).join(''),
  )
  const bulbs = $derived(
    Array.from({ length: swags }, (_, swag) =>
      BULB_STOPS.map((t) => ({
        x: (swag + t) * SWAG_WIDTH,
        y: WIRE_TOP + 4 * SAG * t * (1 - t),
        angle: (Math.atan((4 * SAG * (1 - 2 * t)) / SWAG_WIDTH) * 180 * TILT) / Math.PI + (((swag * 4 + t * 8) % 3) - 1) * JITTER_DEGREES,
      })),
    ).flat(),
  )
  const dark = $derived(mode.current === 'dark')
</script>

<svelte:window bind:innerWidth={width} />

<div class="pointer-events-none absolute inset-x-0 top-0 h-4 overflow-hidden" style="color: {dark ? WIRE_GREEN.dark : WIRE_GREEN.light}" aria-hidden="true">
  <svg width={swags * SWAG_WIDTH} height="16" class="block">
    {#each COLORS as color, c (color)}
      <radialGradient id="string-lights-halo-{c}">
        <stop offset="0%" stop-color={color} stop-opacity="0.55" />
        <stop offset="100%" stop-color={color} stop-opacity="0" />
      </radialGradient>
    {/each}
    <path d={wire} fill="none" stroke="currentColor" stroke-width="0.9" />
    {#each bulbs as bulb, i (i)}
      <g transform="translate({bulb.x} {bulb.y}) rotate({bulb.angle})">
        <rect x="-1.3" y="0" width="2.6" height="3" rx="0.6" fill="currentColor" />
        <g class="bulb" style="--delay: {-((i * 7) % 11) * 0.37}s; --duration: {2.6 + ((i * 5) % 7) * 0.3}s">
          {#if dark}<circle cy="6" r="5" fill="url(#string-lights-halo-{i % COLORS.length})" />{/if}
          <path d={BULB_PATH} transform="translate(0 2.8)" fill={COLORS[i % COLORS.length]} />
          <rect x="-0.6" y="3.4" width="0.5" height="2.6" rx="0.25" fill="white" fill-opacity="0.6" />
        </g>
      </g>
    {/each}
  </svg>
</div>

<style>
  .bulb {
    animation: twinkle var(--duration) ease-in-out var(--delay) infinite;
  }

  @keyframes twinkle {
    50% {
      opacity: 0.45;
    }
  }
</style>
