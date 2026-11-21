<script lang="ts">
  import { cn } from '$lib/utils'

  let { value, expected = null, label, size = 'md' }: {
    value: number
    expected?: number | null
    label: string
    size?: 'sm' | 'md'
  } = $props()

  const percent = (n: number) => Math.min(100, Math.max(0, n * 100))
  const done = $derived(value >= 1)
</script>

<div
  class={cn('hatched relative w-full overflow-hidden rounded-full border border-hatch', size === 'md' ? 'h-3.5' : 'h-2')}
  role="progressbar"
  aria-label={label}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-valuenow={Math.round(percent(value))}
>
  <div
    class={cn('track-fill absolute inset-0 rounded-full transition-transform duration-700 ease-out-quint', done ? 'bg-highlight' : 'bg-foreground')}
    style="transform: translateX({percent(value) - 100}%)"
  ></div>
  {#if expected !== null && expected > 0 && expected < 1 && !done}
    <div
      class="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-foreground shadow-[0_0_0_1.5px_var(--card)]"
      style="left: {percent(expected)}%"
      title="Where the group should be today"
    ></div>
  {/if}
</div>

<style>
  @starting-style {
    .track-fill {
      transform: translateX(-100%) !important;
    }
  }
</style>
