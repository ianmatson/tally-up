<script lang="ts">
  import ScaleIcon from '@lucide/svelte/icons/scale'
  import TimerIcon from '@lucide/svelte/icons/timer'
  import UsersIcon from '@lucide/svelte/icons/users'
  import MailIcon from '@lucide/svelte/icons/mail'
  import BrandMark from '$lib/components/BrandMark.svelte'
  import EmailSignIn from '$lib/components/EmailSignIn.svelte'
  import DemoPhone from '$lib/components/DemoPhone.svelte'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import { resolveRoute, router } from '$lib/router.svelte'

  const signInHref = $derived(`/auth/google?next=${encodeURIComponent(router.url.pathname + router.url.search)}`)
  const isInvite = $derived(resolveRoute(router.url.pathname).name === 'join')
  let emailOpen = $state(false)

  const FEATURES = [
    { icon: UsersIcon, title: 'One goal, the whole crew', body: '10,000 pushups and 50 miles in December? Everyone chips in, and it only counts when the group finishes together.' },
    { icon: TimerIcon, title: 'Know if you are on pace', body: 'One clear number tells you how many days ahead or behind the group is, and what it takes to catch up.' },
    { icon: ScaleIcon, title: 'A leaderboard that is fair', body: 'Each activity is a set share of the goal, and logs past a target do not count, so everyone helps the group finish.' },
  ]
</script>

<div class="min-h-dvh">
  <header class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 pt-[env(safe-area-inset-top)] sm:px-6">
    <span class="flex items-center gap-2.5 text-[0.95rem] font-semibold tracking-tight"><BrandMark draw /> Tally Up</span>
    <Button href="#sign-in" variant="outline" size="sm">Sign in</Button>
  </header>

  <main class="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-8 pb-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:pt-16">
    <section class="rise-in flex flex-col items-start">
      {#if isInvite}
        <Badge variant="highlight" class="mb-5 h-6 px-3">You have been invited to a group</Badge>
      {/if}
      <h1 class="text-[2.75rem] leading-[1.02] font-semibold tracking-[-0.045em] sm:text-6xl lg:text-7xl">
        Hit your goals<br />
        <span class="relative inline-block">
          <span class="relative z-10 dark:text-highlight">together.</span>
          <span class="absolute inset-x-[-0.08em] bottom-[0.08em] -z-0 h-[0.38em] rounded-sm bg-highlight dark:hidden" aria-hidden="true"></span>
        </span>
      </h1>
      <p class="mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">
        Pick a goal with your friends, log every rep and mile, and always know if the crew is on pace.
      </p>
      <div id="sign-in" class="mt-8 flex w-full max-w-sm scroll-mt-24 flex-col gap-2.5">
      <Button href={signInHref} size="lg" class="h-13 gap-3 px-6">
        <svg class="size-5" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.7 2.3 2.4 6.6 2.4 12s4.3 9.7 9.6 9.7c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
        </svg>
        {isInvite ? 'Continue with Google to join' : 'Continue with Google'}
      </Button>
      <Button variant="outline" size="lg" class="h-13 gap-3 px-6" onclick={() => (emailOpen = true)}>
        <MailIcon class="size-5" /> Continue with email
      </Button>
      </div>
      <p class="mt-3 text-sm text-muted-foreground">Free for friend groups. No app to install.</p>
    </section>

    <div class="rise-in flex justify-center [animation-delay:120ms] lg:justify-end">
      <DemoPhone />
    </div>
  </main>

  <section class="mx-auto grid max-w-6xl gap-3 px-4 pb-16 sm:grid-cols-3 sm:px-6" aria-label="Features">
    {#each FEATURES as feature (feature.title)}
      <div class="rounded-card bg-card p-6">
        <div class="mb-4 grid size-10 place-items-center rounded-full bg-highlight text-highlight-foreground">
          <feature.icon class="size-5" />
        </div>
        <h2 class="font-semibold tracking-tight">{feature.title}</h2>
        <p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
      </div>
    {/each}
  </section>

  <EmailSignIn bind:open={emailOpen} />

  <footer class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-sm text-muted-foreground sm:px-6">
    <span class="flex items-center gap-2"><BrandMark size="sm" /> Tally Up</span>
    <nav class="flex gap-5">
      <a href="/privacy" class="hover:text-foreground">Privacy</a>
      <a href="/terms" class="hover:text-foreground">Terms</a>
    </nav>
  </footer>
</div>
