<script lang="ts">
  import type { Member } from '$shared/api'
  import { titleName, type Crown } from '$shared/achievements'
  import { cn } from '$lib/utils'
  import CrownBadge from './CrownBadge.svelte'

  let { member, label, crowns = [], showTitle, class: className }: {
    member: Member
    label: string
    crowns?: Crown[]
    showTitle: boolean
    class?: string
  } = $props()

  const crownCount = $derived(crowns.filter((c) => c.userId === member.id).length)
  const title = $derived(showTitle ? titleName(member.selectedTitle) : undefined)
</script>

<div class="flex items-center gap-1.5">
  <span class={cn('truncate font-medium', className)}>{label}</span>
  {#if crownCount}<CrownBadge count={crownCount} />{/if}
</div>
{#if title}<div class="truncate text-xs text-muted-foreground">{title}</div>{/if}
