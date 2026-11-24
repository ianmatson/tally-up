<script lang="ts">
  import { unitPlural } from '$shared/units'
  import ImagePlusIcon from '@lucide/svelte/icons/image-plus'
  import XIcon from '@lucide/svelte/icons/x'
  import { createMutation, useQueryClient } from '@tanstack/svelte-query'
  import { untrack } from 'svelte'
  import { toast } from 'svelte-sonner'
  import type { Entry, EntryInput, GoalDetail } from '$shared/api'
  import { LIMITS } from '$shared/limits'
  import { api } from '$lib/api'
  import { toLocalInput } from '$lib/format'
  import { scaledPhoto } from '$lib/images'
  import { goalQuery } from '$lib/queries'
  import { Button } from '$lib/components/ui/button'
  import * as Drawer from '$lib/components/ui/drawer'
  import ConfirmDialog from './ConfirmDialog.svelte'
  import DrawerCloseButton from './DrawerCloseButton.svelte'
  import SearchSelect from './SearchSelect.svelte'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { cn } from '$lib/utils'

  let { open = $bindable(false), goal, today, entry }: {
    open: boolean
    goal: GoalDetail
    today: string
    entry: Entry | null
  } = $props()

  const queryClient = useQueryClient()
  const GOAL_ENDED_DEFAULT_TIME = 'T12:00'
  const MAX_LARGE_TILES = 6
  const MAX_CHIPS = 10

  let componentId = $state('')
  let amount = $state('')
  let when = $state('')
  let latestWhen = $state('')
  let note = $state('')
  let confirmDelete = $state(false)
  let photo = $state<Blob | null | undefined>(undefined)
  let preparingPhoto = $state(false)
  let photoInput = $state<HTMLInputElement | null>(null)

  function resetDraft() {
    componentId = entry?.componentId ?? goal.components[0]?.id ?? ''
    amount = entry ? String(entry.amount) : ''
    latestWhen = toLocalInput(Date.now())
    when = entry ? toLocalInput(entry.occurredAt) : today > goal.endDate ? goal.endDate + GOAL_ENDED_DEFAULT_TIME : latestWhen
    note = entry?.note ?? ''
    photo = undefined
  }

  $effect(() => {
    if (open) untrack(resetDraft)
  })

  const selected = $derived(goal.components.find((c) => c.id === componentId))
  const compactTiles = $derived(goal.components.length > MAX_LARGE_TILES)
  const parsedAmount = $derived(Number(amount))
  const canSave = $derived(!!selected && parsedAmount > 0 && !!when && !preparingPhoto)
  const newPhotoUrl = $derived(photo ? URL.createObjectURL(photo) : null)
  const photoUrl = $derived(photo === undefined ? (entry?.photoUrl ?? null) : newPhotoUrl)

  $effect(() => {
    const url = newPhotoUrl
    return () => url && URL.revokeObjectURL(url)
  })

  async function onPickPhoto(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    preparingPhoto = true
    try {
      photo = await scaledPhoto(file)
    } catch {
      toast.error('Could not read that image')
    } finally {
      preparingPhoto = false
    }
  }

  function removePhoto() {
    photo = entry?.photoUrl ? null : undefined
  }

  const onSuccess = (message: string) => () => {
    queryClient.invalidateQueries({ queryKey: goalQuery(goal.id).queryKey })
    queryClient.invalidateQueries({ queryKey: ['group'] })
    toast.success(message)
    open = false
  }

  async function saveEntry(input: EntryInput): Promise<string> {
    if (!entry) return (await api<{ id: string }>(`/goals/${goal.id}/entries`, { method: 'POST', body: input })).id
    await api(`/entries/${entry.id}`, { method: 'PUT', body: input })
    return entry.id
  }

  const save = createMutation(() => ({
    mutationFn: async ({ input, photo }: { input: EntryInput; photo: Blob | null | undefined }) => {
      const id = await saveEntry(input)
      if (photo === undefined) return
      await api(`/entries/${id}/photo`, photo ? { method: 'PUT', body: photo } : { method: 'DELETE' }).catch(() =>
        toast.error('The entry was saved, but the photo was not'),
      )
    },
    onSuccess: onSuccess(entry ? 'Entry updated' : 'Progress logged'),
  }))

  const remove = createMutation(() => ({
    mutationFn: (id: string) => api(`/entries/${id}`, { method: 'DELETE' }),
    onSuccess: onSuccess('Entry deleted'),
  }))

  function submit(event: SubmitEvent) {
    event.preventDefault()
    if (!canSave) return
    const unchanged = entry && when === toLocalInput(entry.occurredAt)
    const occurredAt = unchanged ? entry.occurredAt : new Date(when).getTime()
    save.mutate({ input: { componentId, amount: parsedAmount, occurredAt, note: note.trim() || null }, photo })
  }
</script>

<Drawer.Root bind:open autoFocus>
  <Drawer.Content>
    <form class="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col" onsubmit={submit}>
      <Drawer.Header class="relative px-4 pt-3 pb-4">
        <Drawer.Title class="pr-10 text-xl font-semibold tracking-tight">{entry ? 'Edit entry' : 'Log progress'}</Drawer.Title>
        <Drawer.Description>{goal.name}</Drawer.Description>
        <DrawerCloseButton />
      </Drawer.Header>

      <div class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4">
        <fieldset class="flex flex-col gap-2">
          <legend class="mb-2 text-sm font-medium">Activity</legend>
          {#if goal.components.length > MAX_CHIPS}
            <SearchSelect
              bind:value={componentId}
              label="Activity"
              placeholder="Search activities"
              options={goal.components.map((c) => ({ value: c.id, label: c.name, hint: unitPlural(c.unit) }))}
            />
          {:else}
          <div class={compactTiles ? 'flex flex-wrap gap-1.5' : 'grid grid-cols-2 gap-2'}>
            {#each goal.components as component (component.id)}
              <button
                type="button"
                class={cn(
                  'text-left text-sm transition-colors duration-150',
                  compactTiles ? 'rounded-full px-3.5 py-2' : 'rounded-2xl px-4 py-3',
                  component.id === componentId
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary hover:bg-accent',
                )}
                aria-pressed={component.id === componentId}
                onclick={() => (componentId = component.id)}
              >
                {#if compactTiles}
                  <span class="font-medium">{component.name}</span>
                {:else}
                  <span class="block font-medium">{component.name}</span>
                  <span class="block text-xs opacity-70">{unitPlural(component.unit)}</span>
                {/if}
              </button>
            {/each}
          </div>
          {/if}
        </fieldset>

        <div class="flex flex-col gap-2">
          <Label for="entry-amount">Amount{selected ? ` (${unitPlural(selected.unit)})` : ''}</Label>
          <Input
            id="entry-amount"
            type="number"
            inputmode="decimal"
            min="0"
            step="any"
            placeholder="How many?"
            class="h-14 rounded-2xl text-2xl font-semibold tabular-nums placeholder:text-lg placeholder:font-normal"
            bind:value={amount}
            required
          />
        </div>

        <div class="flex min-w-0 flex-col gap-2">
          <Label for="entry-when">When</Label>
          <Input id="entry-when" type="datetime-local" max={latestWhen} bind:value={when} required />
        </div>
        <div class="flex min-w-0 flex-col gap-2">
          <Label for="entry-note">Note</Label>
          <Input id="entry-note" maxlength={LIMITS.note} placeholder="Optional, like “Felt strong today”" bind:value={note} />
        </div>
        <div class="flex flex-col items-start gap-2">
          <Label for="entry-photo">Photo</Label>
          {#if photoUrl}
            <div class="relative">
              <img src={photoUrl} alt="Attached to this entry" class="max-h-48 rounded-2xl" />
              <button
                type="button"
                class="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/75"
                aria-label="Remove photo"
                onclick={removePhoto}
              >
                <XIcon class="size-4" />
              </button>
            </div>
          {:else}
            <Button type="button" variant="outline" disabled={preparingPhoto} onclick={() => photoInput?.click()}>
              <ImagePlusIcon />
              {preparingPhoto ? 'Preparing…' : 'Add photo'}
            </Button>
          {/if}
          <input bind:this={photoInput} id="entry-photo" type="file" accept="image/*" class="hidden" onchange={onPickPhoto} />
        </div>
      </div>

      <Drawer.Footer class="pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button type="submit" size="lg" class="h-12 text-base" disabled={!canSave || save.isPending}>
          {save.isPending ? 'Saving…' : entry ? 'Save changes' : 'Log it'}
        </Button>
        {#if entry}
          <Button
            variant="destructive"
            size="lg"
            class="h-12"
            disabled={remove.isPending}
            onclick={() => (confirmDelete = true)}
          >
            Delete entry
          </Button>
        {/if}
      </Drawer.Footer>
    </form>
  </Drawer.Content>
</Drawer.Root>

{#if entry}
  <ConfirmDialog
    bind:open={confirmDelete}
    title="Delete this entry?"
    description="It is removed from the group totals, along with its comments and reactions. You cannot undo this."
    confirmLabel="Delete entry"
    onConfirm={() => remove.mutate(entry.id)}
  />
{/if}
