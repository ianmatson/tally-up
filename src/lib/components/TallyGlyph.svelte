<script lang="ts">
  let { class: className = '', draw = false }: { class?: string; draw?: boolean } = $props()

  const STROKES = ['M5 4.5v11', 'M8.7 4.5v11', 'M12.4 4.5v11', 'M16.1 4.5v11', 'M2.8 13.2 18.2 6.8']
  const STROKE_LENGTH = 17
  const DRAW_STAGGER_MS = 90
</script>

<svg class={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
  <g stroke="currentColor" stroke-width="2.1" stroke-linecap="round">
    {#each STROKES as d, i (d)}
      <path
        {d}
        style={draw
          ? `stroke-dasharray:${STROKE_LENGTH};--stroke-length:${STROKE_LENGTH};animation:draw-stroke 320ms var(--ease-out-quint) ${i * DRAW_STAGGER_MS}ms both`
          : undefined}
      />
    {/each}
  </g>
</svg>
