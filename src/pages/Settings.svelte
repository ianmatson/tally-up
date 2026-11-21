<script lang="ts">
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left'
  import CheckIcon from '@lucide/svelte/icons/check'
  import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
  import { setMode, userPrefersMode } from 'mode-watcher'
  import { onMount } from 'svelte'
  import { toast } from 'svelte-sonner'
  import type { NotificationConfig, NotificationSettings, User } from '$shared/api'
  import { api } from '$lib/api'
  import { ACCENTS, accent } from '$lib/accent.svelte'
  import AppHeader from '$lib/components/AppHeader.svelte'
  import LoadError from '$lib/components/LoadError.svelte'
  import PillTabs from '$lib/components/PillTabs.svelte'
  import UserAvatar from '$lib/components/UserAvatar.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import { Switch } from '$lib/components/ui/switch'
  import { formatClockMinutes } from '$lib/format'
  import { notificationsQuery } from '$lib/queries'
  import { currentSubscription, idleDeviceState, pushSupport, saveSubscription, subscribeDevice, unsubscribeDevice } from '$lib/push'
  import { signOut } from '$lib/session'
  import { cn } from '$lib/utils'

  let { user }: { user: User } = $props()

  const THEMES = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ] as const
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const CARD = 'rise-in rounded-card bg-card p-4 sm:p-5'

  type DeviceState = 'checking' | 'on' | 'off' | 'blocked'

  const queryClient = useQueryClient()
  const config = createQuery(notificationsQuery)
  const settings = $derived(config.data?.settings)
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  let device = $state<DeviceState>(pushSupport === 'supported' ? 'checking' : 'off')
  let deviceBusy = $state(false)

  onMount(async () => {
    if (pushSupport !== 'supported') return
    const subscription = await currentSubscription()
    if (subscription) {
      device = 'on'
      saveSubscription(subscription).catch(() => {})
    } else {
      device = idleDeviceState()
    }
  })

  const settingsKey = notificationsQuery().queryKey

  const save = createMutation(() => ({
    scope: { id: 'notification-settings' },
    mutationFn: (change: Partial<NotificationSettings>) => api('/notifications', { method: 'PATCH', body: { ...change, timezone } }),
    onMutate: async (change) => {
      await queryClient.cancelQueries({ queryKey: settingsKey })
      queryClient.setQueryData(settingsKey, (data: NotificationConfig | undefined) => data && { ...data, settings: { ...data.settings, ...change } })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: settingsKey }),
  }))

  const update = (change: Partial<NotificationSettings>) => save.mutate(change)

  const reminderTime = $derived(settings ? formatClockMinutes(settings.reminderMinute) : '')

  function onTimeChange(event: Event) {
    const [hours, minutes] = (event.currentTarget as HTMLInputElement).value.split(':').map(Number)
    if (Number.isFinite(hours) && Number.isFinite(minutes)) update({ reminderMinute: hours * 60 + minutes })
  }

  const dayOn = (day: number) => !!settings && (settings.reminderDays & (1 << day)) !== 0

  function toggleDay(day: number) {
    if (!settings) return
    const next = settings.reminderDays ^ (1 << day)
    if (next !== 0) update({ reminderDays: next })
  }

  async function turnOnDevice() {
    if (!config.data) return
    deviceBusy = true
    try {
      await subscribeDevice(config.data.vapidPublicKey)
      config.refetch()
      device = 'on'
      toast.success('Notifications are on for this device')
    } catch (error) {
      device = idleDeviceState()
      toast.error(error instanceof Error ? error.message : 'Could not turn on notifications')
    } finally {
      deviceBusy = false
    }
  }

  async function turnOffDevice() {
    deviceBusy = true
    await unsubscribeDevice().catch(() => {})
    device = 'off'
    deviceBusy = false
  }

  const sendTest = createMutation(() => ({
    mutationFn: () => api('/notifications/test', { method: 'POST' }),
    onSuccess: () => toast.success('Test sent. It can take a few seconds to arrive.'),
  }))
</script>

<AppHeader {user} />

<main class="mx-auto flex max-w-xl flex-col gap-3 px-4 pt-2 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6">
  <div class="rise-in pt-2 pb-2">
    <a href="/" class="mb-3 -ml-1 flex w-fit items-center gap-1 rounded-full px-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeftIcon class="size-4" /> Back
    </a>
    <h1 class="page-title">Settings</h1>
  </div>

  <section class={CARD} aria-labelledby="appearance-heading">
    <h2 id="appearance-heading" class="font-semibold tracking-tight">Appearance</h2>
    <div class="mt-4 flex items-center justify-between gap-3">
      <span class="text-sm">Theme</span>
      <PillTabs bind:value={() => userPrefersMode.current, setMode} label="Theme" options={[...THEMES]} size="md" />
    </div>
    <div class="mt-5">
      <div class="text-sm" id="accent-label">Accent color</div>
      <p class="text-xs text-muted-foreground">Used for highlights, the log button and your avatar. Saved on this device.</p>
      <div class="mt-3 grid grid-cols-8 gap-2" role="radiogroup" aria-labelledby="accent-label">
        {#each ACCENTS as option (option.value)}
          {@const selected = accent.current === option.value}
          <button
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.name}
            title={option.name}
            class={cn(
              'grid aspect-square place-items-center rounded-full text-[#151515] ring-offset-2 ring-offset-card transition-transform duration-150 ease-spring active:scale-90',
              selected && 'ring-2 ring-foreground',
            )}
            style="background: {option.value}"
            onclick={() => accent.set(option.value)}
          >
            {#if selected}<CheckIcon class="size-4" strokeWidth={2.75} />{/if}
          </button>
        {/each}
      </div>
    </div>
  </section>

  <section class="{CARD} [animation-delay:60ms]" aria-labelledby="notifications-heading">
    <h2 id="notifications-heading" class="font-semibold tracking-tight">Notifications</h2>

    <div class="mt-3 rounded-2xl bg-secondary p-3.5 text-sm">
      {#if pushSupport === 'needs-install'}
        <p class="font-medium">Add Tally Up to your Home Screen first</p>
        <p class="mt-1 text-muted-foreground">
          On iPhone, notifications only work in the installed app. Tap the Share button in Safari, then Add to Home Screen. Open Tally Up from
          your Home Screen and come back here.
        </p>
      {:else if pushSupport === 'unsupported'}
        <p class="text-muted-foreground">This browser cannot show notifications. Try Chrome, Edge, Firefox or Safari.</p>
      {:else if device === 'checking'}
        <Skeleton class="h-10 rounded-xl" />
      {:else if device === 'blocked'}
        <p class="font-medium">Notifications are blocked</p>
        <p class="mt-1 text-muted-foreground">Allow notifications for Tally Up in your browser or system settings, then reload this page.</p>
      {:else if device === 'on'}
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="flex items-center gap-2 font-medium"><span class="size-2 rounded-full bg-[#1baf7a]"></span> On for this device</p>
          <div class="flex gap-1.5">
            <Button size="sm" variant="outline" disabled={sendTest.isPending} onclick={() => sendTest.mutate()}>Send a test</Button>
            <Button size="sm" variant="ghost" disabled={deviceBusy} onclick={turnOffDevice}>Turn off</Button>
          </div>
        </div>
      {:else}
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-muted-foreground">Notifications are off for this device.</p>
          <Button size="sm" disabled={deviceBusy || !config.data} onclick={turnOnDevice}>Turn on</Button>
        </div>
      {/if}
    </div>

    {#if config.isError && !config.data}
      <div class="mt-4"><LoadError message="Could not load your notification settings." onRetry={() => config.refetch()} /></div>
    {:else if !settings}
      <div class="mt-4 flex flex-col gap-3"><Skeleton class="h-12 rounded-xl" /><Skeleton class="h-12 rounded-xl" /></div>
    {:else}
      <p class="mt-4 text-xs text-muted-foreground">These choices apply to every device where notifications are on.</p>
      <ul class="mt-1 flex flex-col divide-y">
        <li class="py-4">
          {@render toggleRow('reminders', 'Daily reminder', 'A nudge to log your progress. Skipped on days you already logged.')}
          {#if settings.reminders}
            <div class="mt-3 flex flex-wrap items-center gap-3">
              <input
                type="time"
                aria-label="Reminder time"
                value={reminderTime}
                onchange={onTimeChange}
                class="h-9 rounded-full bg-secondary px-3.5 text-sm font-medium tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <div class="flex gap-1" role="group" aria-label="Reminder days">
                {#each DAYS as day, i (day)}
                  <button
                    type="button"
                    aria-pressed={dayOn(i)}
                    aria-label={day}
                    title={day}
                    class={cn(
                      'grid size-8 place-items-center rounded-full text-xs font-semibold transition-colors',
                      dayOn(i) ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground',
                    )}
                    onclick={() => toggleDay(i)}
                  >
                    {day[0]}
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        </li>
        <li class="py-4">{@render toggleRow('contributions', 'Group activity', 'When someone in your group logs progress.')}</li>
        <li class="pt-4">{@render toggleRow('comments', 'Comments', 'When someone comments on your logs or on a log you commented on.')}</li>
      </ul>
    {/if}
  </section>

  <section class="{CARD} [animation-delay:120ms]" aria-labelledby="account-heading">
    <h2 id="account-heading" class="font-semibold tracking-tight">Account</h2>
    <div class="mt-4 flex items-center gap-3">
      <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="lg" />
      <div class="min-w-0 flex-1">
        <div class="truncate font-medium">{user.name}</div>
        <div class="truncate text-sm text-muted-foreground">{user.email}</div>
      </div>
      <Button variant="outline" onclick={signOut}>Sign out</Button>
    </div>
  </section>
</main>

{#snippet toggleRow(key: 'reminders' | 'contributions' | 'comments', title: string, hint: string)}
  <label class="flex items-start justify-between gap-4">
    <span>
      <span class="block text-sm font-medium">{title}</span>
      <span class="block text-xs text-muted-foreground">{hint}</span>
    </span>
    <Switch class="mt-0.5" checked={settings?.[key] ?? false} onCheckedChange={(on) => update({ [key]: on })} />
  </label>
{/snippet}
