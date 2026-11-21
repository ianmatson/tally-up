<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query'
  import LoadError from '$lib/components/LoadError.svelte'
  import { meQuery } from '$lib/queries'
  import { resolveRoute, router } from '$lib/router.svelte'
  import GroupShell from './pages/GroupShell.svelte'
  import Home from './pages/Home.svelte'
  import Join from './pages/Join.svelte'
  import NotFound from './pages/NotFound.svelte'
  import Settings from './pages/Settings.svelte'
  import SignIn from './pages/SignIn.svelte'

  const me = createQuery(meQuery)
  const route = $derived(resolveRoute(router.url.pathname))
</script>

<svelte:head>
  {#if route.name !== 'group'}<title>Tally Up · Group workout goals with friends</title>{/if}
</svelte:head>

{#if me.isPending}
  <div class="grid min-h-dvh place-items-center text-muted-foreground">Loading…</div>
{:else if me.isError && me.data === undefined}
  <main class="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">
    <LoadError message="Could not reach the server." onRetry={() => me.refetch()} />
  </main>
{:else if !me.data}
  <SignIn />
{:else if route.name === 'home' || route.name === 'groups'}
  <Home user={me.data} pickGroup={route.name === 'groups'} />
{:else if route.name === 'settings'}
  <Settings user={me.data} />
{:else if route.name === 'join'}
  <Join code={route.code} />
{:else if route.name === 'group'}
  {#key route.groupId}
    <GroupShell groupId={route.groupId} tab={route.tab} user={me.data} />
  {/key}
{:else}
  <NotFound />
{/if}
