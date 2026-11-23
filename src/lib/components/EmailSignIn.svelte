<script lang="ts">
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left'
  import { createMutation } from '@tanstack/svelte-query'
  import { LIMITS } from '$shared/limits'
  import { api } from '$lib/api'
  import { Button } from '$lib/components/ui/button'
  import * as Drawer from '$lib/components/ui/drawer'
  import { Input } from '$lib/components/ui/input'
  import DrawerCloseButton from './DrawerCloseButton.svelte'

  let { open = $bindable(false) }: { open: boolean } = $props()

  const RESEND_SECONDS = 30

  let step = $state<'email' | 'code'>('email')
  let email = $state('')
  let code = $state('')
  let resendIn = $state(0)
  let codeInput = $state<HTMLInputElement | null>(null)
  let countdown: ReturnType<typeof setInterval> | undefined

  function startCountdown() {
    resendIn = RESEND_SECONDS
    clearInterval(countdown)
    countdown = setInterval(() => {
      resendIn -= 1
      if (resendIn <= 0) clearInterval(countdown)
    }, 1000)
  }

  const start = createMutation(() => ({
    meta: { inlineError: true },
    mutationFn: () => api('/auth/email/start', { method: 'POST', body: { email } }),
    onSuccess: () => {
      step = 'code'
      code = ''
      verify.reset()
      startCountdown()
      requestAnimationFrame(() => codeInput?.focus())
    },
  }))

  const verify = createMutation(() => ({
    meta: { inlineError: true },
    mutationFn: () => api('/auth/email/verify', { method: 'POST', body: { email, code } }),
    onSuccess: () => window.location.reload(),
    onError: () => {
      code = ''
      codeInput?.focus()
    },
  }))

  function sendCode(event?: SubmitEvent) {
    event?.preventDefault()
    if (email.trim() && !start.isPending) start.mutate()
  }

  function onCodeInput() {
    code = code.replace(/\D/g, '').slice(0, LIMITS.loginCode)
    if (code.length === LIMITS.loginCode && !verify.isPending) verify.mutate()
  }

  function changeEmail() {
    step = 'email'
    start.reset()
  }
</script>

<Drawer.Root bind:open>
  <Drawer.Content>
    <div class="mx-auto flex w-full max-w-md flex-col px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <Drawer.Header class="relative px-0 pt-3 pb-4 text-left">
        <Drawer.Title class="pr-10 text-xl font-semibold tracking-tight">
          {step === 'email' ? 'Continue with email' : 'Check your email'}
        </Drawer.Title>
        <Drawer.Description>
          {#if step === 'email'}
            We will send you a 6-digit code. No password needed.
          {:else}
            Enter the code we sent to <span class="font-medium text-foreground">{email.trim()}</span>.
          {/if}
        </Drawer.Description>
        <DrawerCloseButton />
      </Drawer.Header>

      {#if step === 'email'}
        <form class="flex flex-col gap-3" onsubmit={sendCode}>
          <Input
            type="email"
            autocomplete="email"
            inputmode="email"
            placeholder="you@example.com"
            aria-label="Email address"
            class="h-12"
            bind:value={email}
            required
          />
          {#if start.error}<p class="text-sm text-destructive" role="alert">{start.error.message}</p>{/if}
          <Button type="submit" size="lg" class="h-12" disabled={!email.trim() || start.isPending}>
            {start.isPending ? 'Sending…' : 'Send code'}
          </Button>
        </form>
      {:else}
        <form class="flex flex-col gap-3" onsubmit={(event) => (event.preventDefault(), code.length === LIMITS.loginCode && verify.mutate())}>
          <Input
            bind:ref={codeInput}
            bind:value={code}
            oninput={onCodeInput}
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength={LIMITS.loginCode}
            placeholder="••••••"
            aria-label="6-digit code"
            aria-invalid={!!verify.error}
            class="h-14 text-center text-2xl font-semibold tracking-[0.5em] tabular-nums placeholder:text-muted-foreground/40 md:text-2xl"
          />
          {#if verify.error}<p class="text-sm text-destructive" role="alert">{verify.error.message}</p>{/if}
          {#if start.error}<p class="text-sm text-destructive" role="alert">{start.error.message}</p>{/if}
          <Button type="submit" size="lg" class="h-12" disabled={code.length !== LIMITS.loginCode || verify.isPending}>
            {verify.isPending ? 'Checking…' : 'Sign in'}
          </Button>
          <div class="flex items-center justify-between text-sm">
            <Button type="button" variant="ghost" size="sm" class="-ml-2 text-muted-foreground" onclick={changeEmail}>
              <ArrowLeftIcon /> Different email
            </Button>
            <Button type="button" variant="ghost" size="sm" class="-mr-2 text-muted-foreground" disabled={resendIn > 0 || start.isPending} onclick={() => sendCode()}>
              {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
            </Button>
          </div>
        </form>
      {/if}
    </div>
  </Drawer.Content>
</Drawer.Root>
