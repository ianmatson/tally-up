<script lang="ts">
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
  import type { Entry, GoalDetail, GroupDetail, User } from '$shared/api'
  import { daysBetween } from '$shared/dates'
  import XIcon from '@lucide/svelte/icons/x'
  import ActivityItem from '$lib/components/ActivityItem.svelte'
  import { install } from '$lib/install.svelte'
  import GoalProgressCard from '$lib/components/GoalProgressCard.svelte'
  import MemberNameLine from '$lib/components/MemberNameLine.svelte'
  import PillTabs from '$lib/components/PillTabs.svelte'
  import TallyGlyph from '$lib/components/TallyGlyph.svelte'
  import UserAvatar from '$lib/components/UserAvatar.svelte'
  import { Button } from '$lib/components/ui/button'
  import { formatDays, formatMembers, formatNumber, formatShare } from '$lib/format'
  import { greeting } from '$lib/greeting'
  import { personalGoals } from '$lib/personal-goals'
  import { crownTallies } from '$lib/crowns'
  import { creditEntries, entriesInPeriod, goalProgress, memberScores, type Period, PERIOD_OPTIONS, rankBy } from '$lib/progress'

  const ACTIVITY_PREVIEW = 5
  const MEMBER_STACK = 4
  const LEADER_PREVIEW = 3

  let { group, goal, now, user, canLog, onOpen, onShowMembers }: {
    group: GroupDetail
    goal: GoalDetail | null
    now: Date
    user: User
    canLog: boolean
    onOpen: (entry: Entry, focusComposer: boolean) => void
    onShowMembers: () => void
  } = $props()

  let leaderPeriod = $state<Period>('all')

  const progress = $derived(goal ? goalProgress(goal, group.timezone, now) : null)
  const personalTargets = $derived(goal ? personalGoals(group, goal, user.id, now) : [])
  const componentsById = $derived(new Map(goal?.components.map((c) => [c.id, c]) ?? []))
  const membersById = $derived(new Map(group.members.map((m) => [m.id, m])))
  const ranked = $derived(
    goal && progress
      ? rankBy(
          memberScores(group.members, goal.components, entriesInPeriod({ ...goal, entries: creditEntries(goal) }, progress.today, leaderPeriod)),
          (s) => s.contribution,
        )
      : [],
  )
  const crowns = $derived(goal && progress ? crownTallies(goal, progress.today) : new Map())
  const daysToStart = $derived(goal && progress ? daysBetween(progress.today, goal.startDate) : 0)
  const leaderRows = $derived.by(() => {
    const top = ranked.slice(0, LEADER_PREVIEW)
    const me = ranked.find((r) => r.item.member.id === user.id)
    return me && !top.includes(me) ? [...top, me] : top
  })
  const goalQueryString = $derived(goal?.archived ? `?goal=${goal.id}` : '')
  const leaderboardHref = $derived(`/g/${group.id}/leaderboard${goalQueryString}`)
  const feedHref = $derived(`/g/${group.id}/feed${goalQueryString}`)

  function subtitle(): string {
    if (!goal || !progress) return ''
    if (progress.phase === 'upcoming') return `${goal.name} · starts in ${formatDays(daysToStart)}`
    if (progress.phase === 'finished') return `${goal.name} · finished`
    return `${goal.name} · day ${progress.dayNumber} of ${progress.totalDays}`
  }
</script>

<div class="mx-auto max-w-xl lg:max-w-none">
  <div class="rise-in flex items-end justify-between gap-3 pt-4 pb-5">
    <div class="min-w-0">
      <h1 class="page-title">{greeting(user.name, now)}</h1>
      {#if goal}<p class="mt-0.5 text-sm text-muted-foreground">{subtitle()}</p>{/if}
    </div>
    <button
      type="button"
      class="flex shrink-0 items-center gap-2 rounded-full bg-card py-1 pr-3 pl-1 text-xs font-medium transition-colors hover:bg-accent"
      aria-label="Show {formatMembers(group.members.length)}"
      onclick={onShowMembers}
    >
      <span class="flex -space-x-1">
        {#each group.members.slice(0, MEMBER_STACK) as member (member.id)}
          <span class="rounded-full ring-2 ring-card">
            <UserAvatar name={member.name} avatarUrl={member.avatarUrl} size="sm" tone={member.id === user.id ? 'highlight' : 'muted'} />
          </span>
        {/each}
      </span>
      <span class="tabular">{group.members.length}</span>
    </button>
  </div>

  {#if install.showTip}
    <div class="rise-in mb-3 flex items-center gap-3 rounded-2xl bg-card py-2.5 pr-2 pl-4 text-sm">
      <TallyGlyph class="size-5 shrink-0" />
      <p class="min-w-0 flex-1">Add Tally Up to your Home Screen for one-tap logging.</p>
      {#if install.promptEvent}
        <Button size="sm" onclick={() => install.promptInstall()}>Install</Button>
      {:else}
        <Button size="sm" variant="secondary" href="/settings#install">How</Button>
      {/if}
      <button
        type="button"
        class="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        aria-label="Dismiss"
        onclick={() => install.dismissTip()}
      >
        <XIcon class="size-4" />
      </button>
    </div>
  {/if}

  {#if !goal || !progress}
    <section class="rise-in rounded-card bg-card p-6">
      <div class="mb-4 grid size-12 place-items-center rounded-full bg-highlight text-highlight-foreground">
        <TallyGlyph class="size-6" />
      </div>
      <h2 class="text-lg font-semibold tracking-tight">No goal yet</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        {group.isOwner
          ? 'Set the first goal for your group: a time period and the things you want to do together.'
          : 'The group admin has not set a goal yet. You will see it here as soon as they do.'}
      </p>
      {#if group.isOwner}<Button href="/g/{group.id}/admin" class="mt-5">Create a goal</Button>{/if}
    </section>
  {:else}
    {#if goal.archived}
      <a href="/g/{group.id}" class="mb-3 flex items-center justify-between rounded-2xl bg-secondary px-4 py-3 text-sm">
        <span class="text-muted-foreground">You are looking at a past goal.</span>
        <span class="flex items-center gap-1 font-medium">Current goal <ChevronRightIcon class="size-4" /></span>
      </a>
    {/if}

    <div class="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start lg:gap-4">
      <div class="flex flex-col gap-3 max-lg:contents lg:gap-4">
        <div class="max-lg:order-1">
          <GoalProgressCard {goal} {progress} memberCount={group.members.length} {daysToStart} />
        </div>

        <section class="rise-in rounded-card bg-card p-4 [animation-delay:180ms] max-lg:order-4 sm:p-5" aria-label="Leaderboard">
          <div class="mb-3 flex items-center justify-between gap-3">
            <a href={leaderboardHref} class="flex items-center gap-1 font-semibold tracking-tight">
              Leaderboard <ChevronRightIcon class="size-4 text-muted-foreground" />
            </a>
            <PillTabs bind:value={leaderPeriod} label="Leaderboard period" options={PERIOD_OPTIONS} />
          </div>
          <ol class="flex flex-col">
            {#each leaderRows as row (row.item.member.id)}
              {@const isMe = row.item.member.id === user.id}
              <li class="flex items-center gap-3 py-2">
                <span class="tabular w-4 text-center text-xs font-medium text-muted-foreground">{row.rank}</span>
                <UserAvatar name={row.item.member.name} avatarUrl={row.item.member.avatarUrl} size="sm" tone={isMe ? 'highlight' : 'muted'} />
                <div class="min-w-0 flex-1">
                  <MemberNameLine member={row.item.member} label={isMe ? 'You' : row.item.member.name} crowns={crowns.get(row.item.member.id)?.total} showTitle={!!group.achievementsEnabled} class="text-sm" />
                </div>
                <span class="tabular shrink-0 text-sm font-semibold">{formatShare(row.value)}</span>
              </li>
            {/each}
          </ol>
        </section>
      </div>

      <div class="flex flex-col gap-3 max-lg:contents lg:gap-4">
        {#if personalTargets.length}
          <section class="rise-in rounded-card bg-card p-4 [animation-delay:210ms] max-lg:order-3 sm:p-5" aria-labelledby="personal-goals-heading">
            <h2 id="personal-goals-heading" class="font-semibold tracking-tight">Your goals</h2>
            <p class="mt-1 text-xs text-muted-foreground">Based on the group’s current daily pace. No rollover.</p>
            <ul class="mt-3 divide-y">
              {#each personalTargets as target (target.label)}
                <li class="flex items-baseline gap-2 py-3">
                  <span class="tabular text-2xl font-semibold tracking-tight" class:text-highlight={target.remaining === 0}>{formatNumber(target.remaining)}</span>
                  <span class="text-sm">{target.label} <span class="text-muted-foreground">left {target.period}</span></span>
                </li>
              {/each}
            </ul>
            <p class="mt-2 text-xs text-muted-foreground">Daily goals reset at midnight. Miles reset Monday. Uses the group’s timezone.</p>
          </section>
        {/if}

        <section class="rise-in rounded-card bg-card p-4 [animation-delay:150ms] max-lg:order-3 sm:p-5" aria-label="Recent activity">
          <div class="mb-3 flex items-center justify-between gap-3">
            <a href={feedHref} class="flex items-center gap-1 font-semibold tracking-tight">
              Recent activity <ChevronRightIcon class="size-4 text-muted-foreground" />
            </a>
          </div>

          {#if goal.entries.length === 0}
            <p class="py-6 text-center text-sm text-muted-foreground">
              {canLog && !goal.archived ? 'Nothing logged yet. Tap + to add the first tally.' : 'Nothing was logged.'}
            </p>
          {/if}

          <ul class="flex flex-col divide-y">
            {#each goal.entries.slice(0, ACTIVITY_PREVIEW) as entry (entry.id)}
              <li class="py-3 first:pt-0 last:pb-0">
                <ActivityItem
                  {entry}
                  component={componentsById.get(entry.componentId)}
                  goalId={goal.id}
                  userId={user.id}
                  {membersById}
                  {now}
                  compact
                  onOpen={(focus) => onOpen(entry, focus)}
                />
              </li>
            {/each}
          </ul>

          {#if goal.entries.length > ACTIVITY_PREVIEW}
            <Button href={feedHref} variant="secondary" class="mt-4 w-full">See the full feed</Button>
          {/if}
        </section>
      </div>
    </div>
  {/if}
</div>
