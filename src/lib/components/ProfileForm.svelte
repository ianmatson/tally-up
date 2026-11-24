<script lang="ts">
  import CameraIcon from '@lucide/svelte/icons/camera'
  import { createMutation, useQueryClient } from '@tanstack/svelte-query'
  import { untrack } from 'svelte'
  import { toast } from 'svelte-sonner'
  import type { User } from '$shared/api'
  import { LIMITS } from '$shared/limits'
  import { api } from '$lib/api'
  import { squareAvatar } from '$lib/images'
  import { firstName as firstWord } from '$lib/format'
  import { meQuery } from '$lib/queries'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import UserAvatar from './UserAvatar.svelte'

  let { user, submitLabel, onSaved }: { user: User; submitLabel: string; onSaved?: () => void } = $props()

  const queryClient = useQueryClient()
  const savedName = untrack(() => user.name)
  let firstName = $state(firstWord(savedName))
  let lastName = $state(savedName.slice(firstWord(savedName).length).trim())
  let fileInput = $state<HTMLInputElement | null>(null)

  const updateMe = (change: Partial<User>) => queryClient.setQueryData(meQuery().queryKey, (me: User | null | undefined) => me && { ...me, ...change })

  const photo = createMutation(() => ({
    mutationFn: async (file: File | null) =>
      file
        ? api<{ user: User }>('/me/avatar', { method: 'PUT', body: await squareAvatar(file) })
        : api<{ user: User }>('/me/avatar', { method: 'DELETE' }),
    onSuccess: ({ user }) => updateMe({ avatarUrl: user.avatarUrl }),
  }))

  const save = createMutation(() => ({
    mutationFn: () => api<{ user: User }>('/me', { method: 'PATCH', body: { name } }),
    onSuccess: ({ user }) => {
      updateMe({ name: user.name })
      onSaved?.()
    },
  }))

  function onPick(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (file) photo.mutate(file, { onError: (error) => error instanceof DOMException && toast.error('Could not read that image') })
  }

  function submit(event: SubmitEvent) {
    event.preventDefault()
    if (firstName.trim() && !save.isPending) save.mutate()
  }

  const name = $derived(`${firstName.trim()} ${lastName.trim()}`.trim())
</script>

<form class="flex flex-col gap-5" onsubmit={submit}>
  <div class="flex items-center gap-4">
    <button
      type="button"
      class="group relative size-20 shrink-0 overflow-hidden rounded-full"
      aria-label={user.avatarUrl ? 'Change photo' : 'Add a photo'}
      disabled={photo.isPending}
      onclick={() => fileInput?.click()}
    >
      <UserAvatar name={name || user.email} avatarUrl={user.avatarUrl} class="size-20 text-xl [&_[data-slot=avatar-fallback]]:text-xl" />
      <span
        class="absolute inset-0 grid place-items-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 data-[busy=true]:opacity-100"
        data-busy={photo.isPending}
      >
        <CameraIcon class="size-5" />
      </span>
    </button>
    <div class="flex flex-col items-start gap-1">
      <Button type="button" variant="outline" size="sm" disabled={photo.isPending} onclick={() => fileInput?.click()}>
        {photo.isPending ? 'Uploading…' : user.avatarUrl ? 'Change photo' : 'Add a photo'}
      </Button>
      {#if user.avatarUrl}
        <Button type="button" variant="ghost" size="sm" class="-my-1 text-muted-foreground" disabled={photo.isPending} onclick={() => photo.mutate(null)}>
          Remove photo
        </Button>
      {/if}
      <p class="px-1 text-xs text-muted-foreground">Optional. Anyone with the link can see it.</p>
    </div>
    <input bind:this={fileInput} type="file" accept="image/*" class="hidden" onchange={onPick} />
  </div>

  <div class="grid gap-3 sm:grid-cols-2">
    <div class="flex flex-col gap-2">
      <Label for="profile-first">First name</Label>
      <Input id="profile-first" autocomplete="given-name" maxlength={LIMITS.name} bind:value={firstName} required />
    </div>
    <div class="flex flex-col gap-2">
      <Label for="profile-last">Last name</Label>
      <Input id="profile-last" autocomplete="family-name" maxlength={LIMITS.name} bind:value={lastName} />
    </div>
  </div>

  <Button type="submit" size="lg" class="h-12" disabled={!firstName.trim() || save.isPending}>
    {save.isPending ? 'Saving…' : submitLabel}
  </Button>
</form>
