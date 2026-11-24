<script lang="ts">
  import type { Member } from '$shared/api'
  import { titleName } from '$shared/achievements'
  import { cn } from '$lib/utils'
  import CrownBadge from './CrownBadge.svelte'

  let { member, label, crowns = 0, showTitle, class: className }: {
    member: Member
    label: string
    crowns?: number
    showTitle: boolean
    class?: string
  } = $props()

  const title = $derived(showTitle ? titleName(member.selectedTitle) : undefined)
</script>

<div class="flex items-center gap-1.5">
  <span class={cn('truncate font-medium', className)}>{label}</span>
  {#if crowns}<CrownBadge count={crowns} />{/if}
</div>
{#if title}<div class="truncate text-xs text-muted-foreground">{title}</div>{/if}
