<script lang="ts">
  import { unitPlural } from '$shared/units'
  import ImagePlusIcon from '@lucide/svelte/icons/image-plus'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import XIcon from '@lucide/svelte/icons/x'
  import { createMutation, useQueryClient } from '@tanstack/svelte-query'
  import { tick, untrack } from 'svelte'
  import { toast } from 'svelte-sonner'
  import type { Entry, EntryAmount, EntryInput, GoalDetail } from '$shared/api'
  import { LIMITS } from '$shared/limits'
  import { api } from '$lib/api'
  import { toLocalInput } from '$lib/format'
  import { scaledPhoto } from '$lib/images'
  import { goalQuery } from '$lib/queries'
  import { Button } from '$lib/components/ui/button'
  import * as Drawer from '$lib/components/ui/drawer'
  import ConfirmDialog from './ConfirmDialog.svelte'
  import DrawerCloseButton from './DrawerCloseButton.svelte'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'

  let { open = $bindable(false), goal, today, entry, userId }: {
    open: boolean
    goal: GoalDetail
    today: string
    entry: Entry | null
    userId: string
  } = $props()

  const queryClient = useQueryClient()
  const GOAL_ENDED_DEFAULT_TIME = 'T12:00'
  const MAX_ALL_ROWS = 6

  let amounts = $state<Record<string, number | null>>({})
  let picked = $state<string[]>([])
  let choosing = $state(false)
  let when = $state('')
  let latestWhen = $state('')
  let note = $state('')
  let confirmDelete = $state(false)
  let photo = $state<Blob | null | undefined>(undefined)
  let preparingPhoto = $state(false)
  let draftId = 0
  let photoInput = $state<HTMLInputElement | null>(null)

  function resetDraft() {
    amounts = draftAmounts(entry?.amounts ?? [])
    picked = componentIds(entry ?? lastEntry)
    choosing = false
    latestWhen = toLocalInput(Date.now())
    when = entry ? toLocalInput(entry.occurredAt) : today > goal.endDate ? goal.endDate + GOAL_ENDED_DEFAULT_TIME : latestWhen
    note = entry?.note ?? ''
    photo = undefined
    preparingPhoto = false
    draftId++
  }

  function draftAmounts(lines: EntryAmount[]) {
    return Object.fromEntries(lines.map((line) => [line.componentId, line.amount]))
  }

  function componentIds(source: Entry | null) {
    return source?.amounts.map((line) => line.componentId) ?? []
  }

  async function pick(componentId: string) {
    picked = [...picked, componentId]
    await tick()
    document.getElementById(`entry-amount-${componentId}`)?.focus()
  }

  $effect(() => {
    if (open) untrack(resetDraft)
  })

  const lastEntry = $derived(entry ? null : (goal.entries.find((e) => e.userId === userId) ?? null))
  const showAll = $derived(goal.components.length <= MAX_ALL_ROWS)
  const rows = $derived(showAll ? goal.components : goal.components.filter((c) => picked.includes(c.id)))
  const unpicked = $derived(showAll ? [] : goal.components.filter((c) => !picked.includes(c.id)))
  const lines = $derived(
    rows.flatMap((c) => {
      const amount = amounts[c.id] ?? 0
      return amount > 0 ? [{ componentId: c.id, amount }] : []
    }),
  )
  const canSave = $derived(lines.length > 0 && !!when && !preparingPhoto)
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
    const pickedFor = draftId
    preparingPhoto = true
    const scaled = await scaledPhoto(file).catch(() => null)
    if (pickedFor !== draftId) return
    preparingPhoto = false
    if (scaled) photo = scaled
    else toast.error('Could not read that image')
  }

  function removePhoto() {
    photo = entry?.photoUrl ? null : undefined
  }

  function finish(message: string, draft: number) {
    queryClient.invalidateQueries({ queryKey: goalQuery(goal.id).queryKey })
    queryClient.invalidateQueries({ queryKey: ['group'] })
    toast.success(message)
    if (draft === draftId) open = false
  }

  async function saveEntry(input: EntryInput, entryId: string | undefined): Promise<string> {
    if (!entryId) return (await api<{ id: string }>(`/goals/${goal.id}/entries`, { method: 'POST', body: input })).id
    await api(`/entries/${entryId}`, { method: 'PUT', body: input })
    return entryId
  }

  const save = createMutation(() => ({
    mutationFn: async ({ input, photo, entryId }: { input: EntryInput; photo: Blob | null | undefined; entryId: string | undefined; draft: number }) => {
      const id = await saveEntry(input, entryId)
      if (photo === undefined) return
      await api(`/entries/${id}/photo`, photo ? { method: 'PUT', body: photo } : { method: 'DELETE' }).catch(() =>
        toast.error('The entry was saved, but the photo was not'),
      )
    },
    onSuccess: (_result, { entryId, draft }) => finish(entryId ? 'Entry updated' : 'Progress logged', draft),
  }))

  const remove = createMutation(() => ({
    mutationFn: ({ id }: { id: string; draft: number }) => api(`/entries/${id}`, { method: 'DELETE' }),
    onSuccess: (_result, { draft }) => finish('Entry deleted', draft),
  }))

  function submit(event: SubmitEvent) {
    event.preventDefault()
    if (!canSave) return
    const unchanged = entry && when === toLocalInput(entry.occurredAt)
    const occurredAt = unchanged ? entry.occurredAt : new Date(when).getTime()
    save.mutate({ input: { amounts: lines, occurredAt, note: note.trim() || null }, photo, entryId: entry?.id, draft: draftId })
  }
</script>

<Drawer.Root bind:open autoFocus>
  <Drawer.Content>
    <form class="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col" onsubmit={submit}>
      <Drawer.Header class="relative h-4 p-0">
        <Drawer.Title class="sr-only">{entry ? 'Edit entry' : 'Log progress'}</Drawer.Title>
        <Drawer.Description class="sr-only">{goal.name}</Drawer.Description>
        <DrawerCloseButton />
      </Drawer.Header>

      <div class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4">
        <fieldset class="flex flex-col">
          <legend class="mb-2 text-sm font-medium">What did you do?</legend>
          {#if rows.length > 0}
            <div class="flex flex-col divide-y rounded-2xl border">
              {#each rows as component (component.id)}
                <label class="flex items-center gap-3 py-2 pr-2 pl-4">
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium">{component.name}</span>
                    <span class="block text-xs text-muted-foreground">{unitPlural(component.unit)}</span>
                  </span>
                  <Input
                    id="entry-amount-{component.id}"
                    type="number"
                    inputmode="decimal"
                    min="0"
                    step="any"
                    class="h-11 w-24 rounded-xl text-right text-lg font-semibold tabular-nums"
                    bind:value={amounts[component.id]}
                  />
                </label>
              {/each}
            </div>
          {/if}
          {#if unpicked.length > 0 && rows.length > 0 && !choosing}
            <button
              type="button"
              class="mt-2 flex w-fit items-center gap-1 rounded-full bg-secondary py-2 pr-3.5 pl-2.5 text-sm font-medium transition-colors hover:bg-accent"
              onclick={() => (choosing = true)}
            >
              <PlusIcon class="size-3.5 text-muted-foreground" />
              Add activity
            </button>
          {:else if unpicked.length > 0}
            <div class="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Add an activity">
              {#each unpicked as component (component.id)}
                <button
                  type="button"
                  class="flex items-center gap-1 rounded-full bg-secondary py-2 pr-3.5 pl-2.5 text-sm font-medium transition-colors hover:bg-accent"
                  onclick={() => pick(component.id)}
                >
                  <PlusIcon class="size-3.5 text-muted-foreground" />
                  {component.name}
                </button>
              {/each}
            </div>
          {/if}
        </fieldset>

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
    onConfirm={() => remove.mutate({ id: entry.id, draft: draftId })}
  />
{/if}
