<script lang="ts">
  import { type ActivityLine, activityList, formatAmount } from '$shared/units'

  let { lines }: { lines: ActivityLine[] } = $props()

  const parts = $derived(activityList.formatToParts(lines.map((_, i) => String(i))))
</script>

{#each parts as part, i (i)}{#if part.type === 'element'}{@const line = lines[Number(part.value)]}<span class="tabular font-semibold">{formatAmount(line.amount, line.unit)}</span>&nbsp;<span class="text-muted-foreground">{line.name.toLowerCase()}</span>{:else}<span class="text-muted-foreground">{part.value}</span>{/if}{/each}
