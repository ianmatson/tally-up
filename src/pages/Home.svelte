<script lang="ts">
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
  import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
  import type { User } from '$shared/api'
  import { LIMITS } from '$shared/limits'
  import { api } from '$lib/api'
  import AppHeader from '$lib/components/AppHeader.svelte'
  import LoadError from '$lib/components/LoadError.svelte'
  import TallyGlyph from '$lib/components/TallyGlyph.svelte'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import { formatMembers, initials } from '$lib/format'
  import { greeting } from '$lib/greeting'
  import { groupsQuery } from '$lib/queries'
  import { readLastGroup } from '$lib/last-group'
  import { navigate } from '$lib/router.svelte'

  let { user, pickGroup }: { user: User; pickGroup: boolean } = $props()

  const queryClient = useQueryClient()
  const groups = createQuery(groupsQuery)
  const autoOpenGroupId = $derived.by(() => {
    if (pickGroup || groups.isFetching || !groups.data?.length) return null
    const last = readLastGroup()
    return groups.data.some((g) => g.id === last) ? last : groups.data[0].id
  })

  const waitingToOpen = $derived(!pickGroup && !!groups.data?.length)

  $effect(() => {
    if (autoOpenGroupId) navigate(`/g/${autoOpenGroupId}`, { replace: true })
  })
  let newGroupName = $state('')

  const createGroup = createMutation(() => ({
    mutationFn: (name: string) =>
      api<{ id: string }>('/groups', {
        method: 'POST',
        body: { name, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      }),
    onSuccess: ({ id }) => {
      queryClient.invalidateQueries({ queryKey: groupsQuery().queryKey })
      navigate(`/g/${id}/admin`)
    },
  }))

  function submit(event: SubmitEvent) {
    event.preventDefault()
    if (newGroupName.trim()) createGroup.mutate(newGroupName.trim())
  }
</script>

<AppHeader {user} />

<main class="mx-auto flex max-w-xl flex-col gap-6 px-4 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6">
  <h1 class="rise-in page-title">{greeting(user.name, new Date())}</h1>

  <section class="flex flex-col gap-2" aria-labelledby="groups-heading">
    <h2 id="groups-heading" class="text-sm font-medium text-muted-foreground">Your groups</h2>
    {#if groups.isPending || waitingToOpen}
      <Skeleton class="h-[4.5rem] rounded-card" />
      <Skeleton class="h-[4.5rem] rounded-card" />
    {:else if groups.isError}
      <LoadError message="Could not load your groups." onRetry={() => groups.refetch()} />
    {:else if groups.data.length}
      {#each groups.data as group, i (group.id)}
        <a
          href="/g/{group.id}"
          class="rise-in flex items-center gap-3 rounded-card bg-card px-4 py-4 transition-colors hover:bg-accent"
          style="animation-delay: {i * 50}ms"
        >
          <span class="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold">{initials(group.name)}</span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 font-medium">
              <span class="truncate">{group.name}</span>
              {#if group.isAdmin}<Badge variant="highlight">Admin</Badge>{/if}
            </div>
            <div class="text-sm text-muted-foreground">{formatMembers(group.memberCount)}</div>
          </div>
          <ChevronRightIcon class="size-5 text-muted-foreground" />
        </a>
      {/each}
    {:else}
      <div class="rounded-card bg-card px-6 py-8 text-center">
        <div class="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-highlight text-highlight-foreground"><TallyGlyph class="size-6" /></div>
        <p class="font-medium">No groups yet</p>
        <p class="mt-1 text-sm text-muted-foreground">Create one below, or open an invite link from a friend.</p>
      </div>
    {/if}
  </section>

  <section class="rounded-card bg-card p-5" aria-labelledby="create-heading">
    <h2 id="create-heading" class="font-semibold tracking-tight">Create a group</h2>
    <p class="mt-1 text-sm text-muted-foreground">You will be the admin, and you can invite friends with a link.</p>
    <form class="mt-4 flex gap-2" onsubmit={submit}>
      <Input placeholder="Group name" maxlength={LIMITS.name} bind:value={newGroupName} aria-label="Group name" />
      <Button type="submit" class="h-11" disabled={!newGroupName.trim() || createGroup.isPending}>Create</Button>
    </form>
  </section>
</main>
