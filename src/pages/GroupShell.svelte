<script lang="ts">
  import { toast } from 'svelte-sonner'
  import { CROWNS, titleName, type TitleId } from '$shared/achievements'
  import { api } from '$lib/api'
  import { queryClient } from '$lib/queries'
  import { createQuery } from '@tanstack/svelte-query'
  import { untrack } from 'svelte'
  import type { Entry, User } from '$shared/api'
  import { todayIn } from '$shared/dates'
  import EntryDrawer from '$lib/components/EntryDrawer.svelte'
  import EntryThreadDrawer from '$lib/components/EntryThreadDrawer.svelte'
  import MembersDrawer from '$lib/components/MembersDrawer.svelte'
  import AppHeader from '$lib/components/AppHeader.svelte'
  import BottomNav from '$lib/components/BottomNav.svelte'
  import { isNotFound } from '$lib/api'
  import LoadError from '$lib/components/LoadError.svelte'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import { rememberLastGroup } from '$lib/last-group'
  import { goalQuery, groupQuery } from '$lib/queries'
  import { GROUP_TABS, type GroupTab, groupTabHref, navigate, router } from '$lib/router.svelte'
  import Admin from './Admin.svelte'
  import Dashboard from './Dashboard.svelte'
  import Feed from './Feed.svelte'
  import History from './History.svelte'
  import Leaderboard from './Leaderboard.svelte'
  import NotFound from './NotFound.svelte'

  const CLOCK_TICK_MS = 60_000

  let { groupId, tab, user }: { groupId: string; tab: GroupTab; user: User } = $props()

  const group = createQuery(() => groupQuery(groupId))
  const currentGoalId = $derived(group.data?.goals.find((g) => !g.archived)?.id)
  const viewedGoalId = $derived(router.url.searchParams.get('goal') ?? currentGoalId)
  const currentGoal = createQuery(() => ({ ...goalQuery(currentGoalId ?? ''), enabled: !!currentGoalId }))
  const viewedGoal = createQuery(() => ({ ...goalQuery(viewedGoalId ?? ''), enabled: !!viewedGoalId }))
  const tabGoal = $derived(tab === 'admin' ? currentGoal : tab === 'history' ? null : viewedGoal)
  const tabGoalId = $derived(tab === 'admin' ? currentGoalId : tab === 'history' ? undefined : viewedGoalId)

  let now = $state(new Date())
  $effect(() => {
    const timer = setInterval(() => (now = new Date()), CLOCK_TICK_MS)
    return () => clearInterval(timer)
  })

  $effect(() => {
    if (group.data) rememberLastGroup(group.data.id)
  })

  const today = $derived(group.data ? todayIn(group.data.timezone, now) : '')
  const canLog = $derived(!!currentGoal.data && today >= currentGoal.data.startDate)

  let drawerOpen = $state(false)
  let editingEntry = $state<Entry | null>(null)
  let threadOpen = $state(false)
  let threadEntryId = $state<string | null>(null)
  let threadFocus = $state(false)
  let membersOpen = $state(false)

  const threadEntry = $derived(viewedGoal.data?.entries.find((e) => e.id === threadEntryId) ?? null)

  function openLog(entry: Entry | null = null) {
    editingEntry = entry
    drawerOpen = true
  }

  function openThread(entry: Entry, focusComposer: boolean) {
    threadEntryId = entry.id
    threadFocus = focusComposer
    threadOpen = true
  }

  function editFromThread(entry: Entry) {
    threadOpen = false
    openLog(entry)
  }

  $effect(() => {
    const linkedEntryId = router.url.searchParams.get('entry')
    if (!linkedEntryId || !viewedGoalId) return
    untrack(() => viewedGoal.refetch()).then(({ data, isSuccess }) => {
      if (!isSuccess) return
      const entry = data.entries.find((e) => e.id === linkedEntryId)
      if (entry) openThread(entry, false)
      const url = new URL(router.url)
      url.searchParams.delete('entry')
      navigate(url.pathname + url.search, { replace: true })
    })
  })

  // Baseline the first response without celebrating historical/backfilled awards.
  let titleBaseline: Set<string> | undefined
  let crownBaseline: Set<string> | undefined
  let awardsGroup = ''
  let awardsGoal = ''
  $effect(() => {
    const data = group.data
    if (!data) return
    if (awardsGroup !== data.id) { awardsGroup = data.id; titleBaseline = undefined }
    const earned = data.earnedTitles?.filter((t) => t.userId === user.id) ?? []
    if (titleBaseline) {
      for (const title of earned.filter((t) => !titleBaseline!.has(t.titleId))) {
        const titleId: TitleId = title.titleId
        toast.success(`You're now ${titleName(titleId)}.`, {
          action: { label: 'Equip title', onClick: () => {
            api('/me/title', { method: 'PUT', body: { titleId } })
              .then(() => queryClient.invalidateQueries({ queryKey: ['group'] }))
              .catch((error: Error) => toast.error(error.message))
          } },
        })
      }
    }
    titleBaseline = new Set(earned.map((t) => t.titleId))
  })
  $effect(() => {
    const data = currentGoal.data
    if (!data) return
    if (awardsGoal !== data.id) { awardsGoal = data.id; crownBaseline = undefined }
    const crowns = data.crowns?.filter((c) => c.userId === user.id) ?? []
    if (crownBaseline) {
      for (const crown of crowns.filter((c) => !crownBaseline!.has(c.category))) {
        toast.success(`You claimed ${CROWNS[crown.category].name}!`, {
          description: `${crown.total.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${CROWNS[crown.category].unit}`,
        })
      }
    }
    crownBaseline = new Set(crowns.map((c) => c.category))
  })

  const navItems = $derived(
    GROUP_TABS.filter((t) => t.inNav).map((t) => ({
      id: t.id,
      label: t.navLabel,
      href: groupTabHref(groupId, t),
    })),
  )
  const pageTitle = $derived(GROUP_TABS.find((t) => t.id === tab)!.title)
</script>

<svelte:head>
  <title>{group.data ? `${pageTitle} · ${group.data.name} · Tally Up` : 'Tally Up'}</title>
</svelte:head>

{#if group.isError && isNotFound(group.error)}
  <NotFound />
{:else if group.isError && !group.data}
  <main class="mx-auto max-w-xl px-4 pt-[calc(1rem+env(safe-area-inset-top))]">
    <LoadError message="Could not load this group." onRetry={() => group.refetch()} />
  </main>
{:else}
  <AppHeader {user} currentGroup={group.data ?? null} />

  <main class="mx-auto max-w-6xl px-4 pt-2 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:px-6">
    {#if !group.data || (tabGoalId && tabGoal?.isPending)}
      <div class="mx-auto flex max-w-xl flex-col gap-3 pt-4" aria-busy="true" aria-label="Loading">
        <Skeleton class="h-8 w-48 rounded-full" />
        <div class="grid grid-cols-2 gap-3"><Skeleton class="h-28 rounded-card" /><Skeleton class="h-28 rounded-card" /></div>
        <Skeleton class="h-56 rounded-card" />
        <Skeleton class="h-40 rounded-card" />
      </div>
    {:else if tabGoal?.isError && !tabGoal.data}
      <LoadError message="Could not load this goal." onRetry={() => tabGoal.refetch()} />
    {:else if tab === 'dashboard'}
      <Dashboard
        group={group.data}
        goal={viewedGoal.data ?? null}
        {now}
        {user}
        {canLog}
        onOpen={openThread}
        onShowMembers={() => (membersOpen = true)}
      />
    {:else if tab === 'feed'}
      <Feed group={group.data} goal={viewedGoal.data ?? null} {now} {user} {canLog} onOpen={openThread} />
    {:else if tab === 'leaderboard'}
      <Leaderboard group={group.data} goal={viewedGoal.data ?? null} {today} {user} />
    {:else if tab === 'history'}
      <History group={group.data} />
    {:else if tab === 'admin' && group.data.isOwner}
      <Admin group={group.data} goal={currentGoal.data ?? null} {today} />
    {:else}
      <NotFound />
    {/if}
  </main>

  <BottomNav items={navItems} active={tab} {canLog} onLog={() => openLog()} />

  {#if currentGoal.data}
    <EntryDrawer bind:open={drawerOpen} goal={currentGoal.data} {today} entry={editingEntry} />
  {/if}
  {#if group.data && viewedGoal.data}
    <EntryThreadDrawer
      bind:open={threadOpen}
      entry={threadEntry}
      goal={viewedGoal.data}
      group={group.data}
      {user}
      {now}
      focusComposer={threadFocus}
      onEdit={editFromThread}
    />
  {/if}
  {#if group.data}
    <MembersDrawer bind:open={membersOpen} group={group.data} goal={viewedGoal.data ?? null} {today} {user} />
  {/if}
{/if}
