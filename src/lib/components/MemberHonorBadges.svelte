<script lang="ts">
  import CrownIcon from '@lucide/svelte/icons/crown'
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
        variant="highlight"
        class="h-auto min-h-5 max-w-full whitespace-normal text-[0.65rem]"
        title="{detail.label} · full goal totals"
        aria-label="Crown: {detail.name}, {detail.label}"
      >
        <CrownIcon class="shrink-0" aria-hidden="true" /> {detail.name}
      </Badge>
    {/each}
  </div>
{/if}
