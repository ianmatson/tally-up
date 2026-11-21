<script lang="ts">
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
  import type { GroupDetail } from '$shared/api'
  import { Badge } from '$lib/components/ui/badge'
  import { formatDateRange } from '$lib/format'

  let { group }: { group: GroupDetail } = $props()
</script>

<div class="mx-auto flex max-w-2xl flex-col gap-3">
  <div class="rise-in pt-4 pb-2">
    <h1 class="page-title">History</h1>
    <p class="mt-0.5 text-sm text-muted-foreground">Every goal this group has taken on</p>
  </div>
  {#if group.goals.length === 0}
    <p class="rounded-card bg-card px-5 py-8 text-center text-sm text-muted-foreground">No goals yet.</p>
  {:else}
    <ul class="rise-in divide-y overflow-hidden rounded-card bg-card">
      {#each group.goals as goal (goal.id)}
        <li>
          <a
            href={goal.archived ? `/g/${group.id}?goal=${goal.id}` : `/g/${group.id}`}
            class="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-accent"
          >
            <div class="min-w-0 flex-1">
              <div class="truncate font-medium">{goal.name}</div>
              <div class="text-sm text-muted-foreground">{formatDateRange(goal.startDate, goal.endDate)}</div>
            </div>
            {#if !goal.archived}
              <Badge variant="highlight">Current</Badge>
            {/if}
            <ChevronRightIcon class="size-4 text-muted-foreground" />
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</div>
