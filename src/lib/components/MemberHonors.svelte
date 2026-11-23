<script lang="ts">
  import { createMutation, useQueryClient } from '@tanstack/svelte-query'
  import { toast } from 'svelte-sonner'
  import type { GoalDetail, GroupDetail, Member } from '$shared/api'
  import { CROWNS, TITLES, currentStreak, type TitleId } from '$shared/achievements'
  import { api } from '$lib/api'
  import { formatAmount } from '$shared/units'
  import { Button } from '$lib/components/ui/button'

  let { member, group, goal, today, userId }: {
    member: Member; group: GroupDetail; goal: GoalDetail | null; today: string; userId: string
  } = $props()
  const client = useQueryClient()
  const crowns = $derived(goal?.crowns?.filter((c) => c.userId === member.id) ?? [])
  const earned = $derived(new Set(group.earnedTitles?.filter((t) => t.userId === member.id).map((t) => t.titleId)))
  const streak = $derived(currentStreak(goal?.entries.filter((e) => e.userId === member.id && e.amount > 0 && e.date >= goal.startDate && e.date <= goal.endDate).map((e) => e.date) ?? [], today))
  const next = $derived(TITLES.find((t) => !earned.has(t.id)))
  const records = $derived(goal?.crownRecords?.filter((r) => r.userId === member.id && !crowns.some((c) => c.category === r.category)) ?? [])
  const equip = createMutation(() => ({
    mutationFn: (titleId: TitleId) => api('/me/title', { method: 'PUT', body: { titleId } }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['group'] })
      toast.success('Title equipped')
    },
  }))
</script>

<div class="space-y-4 rounded-2xl bg-secondary/50 p-4">
  <section aria-label="Crowns">
    <h3 class="text-sm font-semibold">{goal?.archived || (goal && today > goal.endDate) ? 'Goal crowns' : 'Current crowns'}</h3>
    {#if goal}<p class="mt-0.5 text-xs text-muted-foreground">{goal.name} · full goal totals</p>{/if}
    {#if crowns.length}
      <ul class="mt-2 flex flex-wrap gap-2">
        {#each crowns as crown (crown.category)}
          <li class="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-900 dark:text-amber-200">
            <div class="text-sm font-semibold"><span aria-hidden="true">👑</span> {CROWNS[crown.category].name}</div>
            <div class="text-xs">{CROWNS[crown.category].label} · {formatAmount(crown.total, CROWNS[crown.category].unit)}</div>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="mt-2 text-xs text-muted-foreground">No crowns held yet. Take the lead to claim one.</p>
    {/if}
    {#if records.length}
      <p class="mt-2 text-xs text-muted-foreground">Previously held: {records.map((r) => CROWNS[r.category].name).join(', ')}.</p>
    {/if}
  </section>

  <section aria-label="Earned titles">
    <h3 class="text-sm font-semibold">Earned titles</h3>
    <p class="mt-0.5 text-xs text-muted-foreground">Yours to keep. {member.id === userId ? 'Choose one to display.' : ''}</p>
    <div class="mt-2 flex flex-wrap gap-2">
      {#each TITLES.filter((t) => earned.has(t.id)) as title (title.id)}
        {#if member.id === userId}
          <Button size="sm" variant={member.selectedTitle === title.id ? 'secondary' : 'outline'}
            class="text-xs" disabled={equip.isPending} aria-pressed={member.selectedTitle === title.id}
            onclick={() => equip.mutate(title.id)}>{title.name}{member.selectedTitle === title.id ? ' ✓' : ''}</Button>
        {:else}
          <span class="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">{title.name}</span>
        {/if}
      {:else}
        <p class="text-xs text-muted-foreground">Make a first contribution to become an Initiate.</p>
      {/each}
    </div>
    {#if next}
      <div class="mt-3">
        <div class="flex justify-between gap-2 text-xs"><span class="font-medium">Next: {next.name}</span><span class="text-muted-foreground">{Math.min(streak, next.days)} / {next.days} {next.days === 1 ? 'day' : 'consecutive days'}</span></div>
        <progress class="mt-2 h-1.5 w-full accent-current" value={Math.min(streak, next.days)} max={next.days} aria-label="Progress toward {next.name}"></progress>
        <p class="mt-1 text-xs text-muted-foreground">{next.days === 1 ? 'Log your first contribution.' : `Log activity ${next.days} days in a row within one goal.`} Days follow {group.timezone}.</p>
      </div>
    {:else}
      <p class="mt-3 text-xs text-muted-foreground">Every title unlocked. Legendary.</p>
    {/if}
  </section>
</div>
