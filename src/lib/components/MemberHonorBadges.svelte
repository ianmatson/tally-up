<script lang="ts">
  import type { Member } from '$shared/api'
  import { CROWNS, titleName, type Crown } from '$shared/achievements'
  import { Badge } from '$lib/components/ui/badge'

  let { member, crowns = [] }: { member: Member; crowns?: Crown[] } = $props()

  const title = $derived(titleName(member.selectedTitle))
  const heldCrowns = $derived(crowns.filter((crown) => crown.userId === member.id))
</script>

{#if title || heldCrowns.length}
  <div class="mt-1 flex flex-wrap gap-1" role="group" aria-label="Titles and crowns">
    {#if title}
      <Badge variant="secondary" class="h-auto min-h-5 max-w-full whitespace-normal text-[0.65rem]" aria-label="Title: {title}">{title}</Badge>
    {/if}
    {#each heldCrowns as crown (crown.category)}
      {@const detail = CROWNS[crown.category]}
      <Badge
        variant="outline"
        class="h-auto min-h-5 max-w-full border-amber-500/30 bg-amber-500/10 whitespace-normal text-[0.65rem] text-amber-900 dark:text-amber-200"
        title="{detail.label} · full goal totals"
        aria-label="Crown: {detail.name}, {detail.label}"
      >
        <span aria-hidden="true">👑</span> {detail.name}
      </Badge>
    {/each}
  </div>
{/if}
