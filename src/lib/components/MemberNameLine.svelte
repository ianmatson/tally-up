<script lang="ts">
  import type { Member } from '$shared/api'
  import { titleName, type Crown } from '$shared/achievements'
  import { cn } from '$lib/utils'
  import CrownBadge from './CrownBadge.svelte'

  let { member, label, crowns = [], showHonors, class: className }: {
    member: Member
    label: string
    crowns?: Crown[]
    showHonors: boolean
    class?: string
  } = $props()

  const crownCount = $derived(showHonors ? crowns.filter((c) => c.userId === member.id).length : 0)
  const title = $derived(showHonors ? titleName(member.selectedTitle) : undefined)
</script>

<div class="flex items-center gap-1.5">
  <span class={cn('truncate font-medium', className)}>{label}</span>
  {#if crownCount}<CrownBadge count={crownCount} />{/if}
</div>
{#if title}<div class="truncate text-xs text-muted-foreground">{title}</div>{/if}
