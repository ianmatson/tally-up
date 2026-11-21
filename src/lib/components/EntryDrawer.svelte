<script lang="ts">
  import { createMutation, useQueryClient } from '@tanstack/svelte-query'
  import { untrack } from 'svelte'
  import { toast } from 'svelte-sonner'
  import type { Entry, EntryInput, GoalDetail } from '$shared/api'
  import { LIMITS } from '$shared/limits'
  import { api } from '$lib/api'
  import { toLocalInput } from '$lib/format'
  import { goalQuery } from '$lib/queries'
  import { Button } from '$lib/components/ui/button'
  import * as Drawer from '$lib/components/ui/drawer'
  import DrawerCloseButton from './DrawerCloseButton.svelte'
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

  let componentId = $state('')
  let amount = $state('')
  let when = $state('')
  let latestWhen = $state('')
  let note = $state('')

  function resetDraft() {
    componentId = entry?.componentId ?? goal.components[0]?.id ?? ''
    amount = entry ? String(entry.amount) : ''
    latestWhen = toLocalInput(Date.now())
    when = entry ? toLocalInput(entry.occurredAt) : today > goal.endDate ? goal.endDate + GOAL_ENDED_DEFAULT_TIME : latestWhen
    note = entry?.note ?? ''
  }

  $effect(() => {
    if (open) untrack(resetDraft)
  })

  const selected = $derived(goal.components.find((c) => c.id === componentId))
  const parsedAmount = $derived(Number(amount))
  const canSave = $derived(!!selected && parsedAmount > 0 && !!when)

  const onSuccess = (message: string) => () => {
    queryClient.invalidateQueries({ queryKey: goalQuery(goal.id).queryKey })
    toast.success(message)
    open = false
  }

  const save = createMutation(() => ({
    mutationFn: (input: EntryInput) =>
      entry
        ? api(`/entries/${entry.id}`, { method: 'PUT', body: input })
        : api(`/goals/${goal.id}/entries`, { method: 'POST', body: input }),
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
    save.mutate({ componentId, amount: parsedAmount, occurredAt, note: note.trim() || null })
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
          <div class="grid grid-cols-2 gap-2">
            {#each goal.components as component (component.id)}
              <button
                type="button"
                class={cn(
                  'rounded-2xl px-4 py-3 text-left text-sm transition-colors duration-150',
                  component.id === componentId
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary hover:bg-accent',
                )}
                aria-pressed={component.id === componentId}
                onclick={() => (componentId = component.id)}
              >
                <span class="block font-medium">{component.name}</span>
                <span class="block text-xs opacity-70">{component.unit}</span>
              </button>
            {/each}
          </div>
        </fieldset>

        <div class="flex flex-col gap-2">
          <Label for="entry-amount">Amount{selected ? ` (${selected.unit})` : ''}</Label>
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
            onclick={() => remove.mutate(entry.id)}
          >
            Delete entry
          </Button>
        {/if}
      </Drawer.Footer>
    </form>
  </Drawer.Content>
</Drawer.Root>
