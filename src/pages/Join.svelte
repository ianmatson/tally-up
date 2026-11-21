<script lang="ts">
  import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
  import { api, isNotFound } from '$lib/api'
  import BrandMark from '$lib/components/BrandMark.svelte'
  import LoadError from '$lib/components/LoadError.svelte'
  import { Button } from '$lib/components/ui/button'
  import { formatMembers } from '$lib/format'
  import { groupsQuery, inviteQuery } from '$lib/queries'
  import { navigate } from '$lib/router.svelte'

  let { code }: { code: string } = $props()

  const queryClient = useQueryClient()
  const invite = createQuery(() => inviteQuery(code))

  const join = createMutation(() => ({
    mutationFn: () => api<{ groupId: string }>(`/invites/${code}`, { method: 'POST' }),
    onSuccess: ({ groupId }) => {
      queryClient.invalidateQueries({ queryKey: groupsQuery().queryKey })
      navigate(`/g/${groupId}`, { replace: true })
    },
  }))
</script>

<main class="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
  {#if invite.isPending}
    <p class="text-center text-muted-foreground" aria-busy="true">Loading invite…</p>
  {:else if invite.isError && !isNotFound(invite.error)}
    <LoadError message="Could not load this invite." onRetry={() => invite.refetch()} />
  {:else if invite.isError}
    <section class="rise-in rounded-card bg-card p-7 text-center">
      <h1 class="text-xl font-semibold tracking-tight">Invite not found</h1>
      <p class="mt-2 text-sm text-muted-foreground">This link is not valid anymore. Ask the group admin for a new one.</p>
      <Button href="/groups" class="mt-6">Go to your groups</Button>
    </section>
  {:else if invite.data}
    <section class="rise-in rounded-card bg-card p-7 text-center">
      <div class="flex justify-center"><BrandMark size="lg" draw /></div>
      <p class="mt-5 text-sm text-muted-foreground">You are invited to join</p>
      <h1 class="mt-1 text-3xl font-semibold tracking-tight">{invite.data.groupName}</h1>
      <p class="mt-1 text-sm text-muted-foreground">{formatMembers(invite.data.memberCount)}</p>
      {#if invite.data.alreadyMember}
        <Button href="/g/{invite.data.groupId}" size="lg" class="mt-7 w-full">You are a member · Open group</Button>
      {:else}
        <Button size="lg" class="mt-7 w-full" disabled={join.isPending} onclick={() => join.mutate()}>
          {join.isPending ? 'Joining…' : 'Join group'}
        </Button>
      {/if}
    </section>
  {/if}
</main>
