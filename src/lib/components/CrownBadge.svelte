<script lang="ts">
  import CrownIcon from '@lucide/svelte/icons/crown'

  let { count }: { count: number } = $props()
</script>

<span
  class="inline-flex h-5 shrink-0 items-center gap-0.5 rounded-full bg-highlight px-1.5 text-[11px] font-semibold text-highlight-foreground"
  aria-label="{count} {count === 1 ? 'crown' : 'crowns'}"
>
  <CrownIcon class="size-3" aria-hidden="true" />
  {#if count > 1}<span class="tabular">{count}</span>{/if}
</span>
