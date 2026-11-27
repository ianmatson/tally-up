<script lang="ts">
  import { mode } from 'mode-watcher'

  const SWAG_WIDTH = 56
  const SAG = 6
  const WIRE_TOP = 1
  const BULB_STOPS = [0.22, 0.5, 0.78]
  const COLORS = ['#e5484d', '#ffc53d', '#30a46c', '#3e8ef7']
  const TILT = 0.6

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
        angle: (Math.atan((4 * SAG * (1 - 2 * t)) / SWAG_WIDTH) * 180 * TILT) / Math.PI,
      })),
    ).flat(),
  )
  const glow = $derived(mode.current === 'dark' ? 'url(#string-lights-glow)' : undefined)
</script>

<svelte:window bind:innerWidth={width} />

<div class="pointer-events-none absolute inset-x-0 top-full h-6 overflow-hidden text-foreground" aria-hidden="true">
  <svg width={swags * SWAG_WIDTH} height="24" class="block">
    <filter id="string-lights-glow" x="-150%" y="-100%" width="400%" height="300%">
      <feGaussianBlur stdDeviation="2.2" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <path d={wire} fill="none" stroke="currentColor" stroke-opacity="0.4" stroke-width="1.2" />
    {#each bulbs as bulb, i (i)}
      <g transform="translate({bulb.x} {bulb.y}) rotate({bulb.angle})">
        <rect x="-1.8" y="0" width="3.6" height="3.4" rx="0.8" fill="currentColor" fill-opacity="0.55" />
        <g class="bulb" style="--delay: {-((i * 7) % 11) * 0.37}s; --duration: {2.6 + ((i * 5) % 7) * 0.3}s">
          <ellipse cy="8" rx="3" ry="4.6" fill={COLORS[i % COLORS.length]} filter={glow} />
          <ellipse cx="-1" cy="6.4" rx="0.8" ry="1.6" fill="white" fill-opacity="0.55" />
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
