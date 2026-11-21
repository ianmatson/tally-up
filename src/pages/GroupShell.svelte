<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query'
  import type { Entry, User } from '$shared/api'
  import { todayIn } from '$shared/dates'
  import EntryDrawer from '$lib/components/EntryDrawer.svelte'
  import AppHeader from '$lib/components/AppHeader.svelte'
  import BottomNav from '$lib/components/BottomNav.svelte'
  import { isNotFound } from '$lib/api'
  import LoadError from '$lib/components/LoadError.svelte'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import { goalQuery, groupQuery } from '$lib/queries'
  import { GROUP_TABS, type GroupTab, groupTabHref, router } from '$lib/router.svelte'
  import Admin from './Admin.svelte'
  import Dashboard from './Dashboard.svelte'
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

  const today = $derived(group.data ? todayIn(group.data.timezone, now) : '')
  const canLog = $derived(!!currentGoal.data && today >= currentGoal.data.startDate)

  let drawerOpen = $state(false)
  let editingEntry = $state<Entry | null>(null)

  function openLog(entry: Entry | null = null) {
    editingEntry = entry
    drawerOpen = true
  }

  const navItems = $derived(
    GROUP_TABS.filter((t) => !t.ownerOnly || group.data?.isOwner).map((t) => ({
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
      <Dashboard group={group.data} goal={viewedGoal.data ?? null} {now} {user} {canLog} onLog={openLog} />
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
{/if}
