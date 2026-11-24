<script lang="ts">
  import { formatAmount } from '$shared/units'
  import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import ScaleIcon from '@lucide/svelte/icons/scale'
  import Trash2Icon from '@lucide/svelte/icons/trash-2'
  import { tick, untrack } from 'svelte'
  import { flip } from 'svelte/animate'
  import type { ComponentPeriod, GoalDetail, GoalInput } from '$shared/api'
  import { addDays, isIsoDate } from '$shared/dates'
  import { LIMITS } from '$shared/limits'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { formatNumber } from '$lib/format'
  import { MOVE_MS, prefersReducedMotion } from '$lib/motion'
  import { cn } from '$lib/utils'

  const DEFAULT_GOAL_DAYS = 30
  const WHOLE_GOAL = 100
  const MIN_SHARE = 0.01
  const PERIOD_OPTIONS: { value: ComponentPeriod; label: string }[] = [
    { value: 'day', label: 'Daily' },
    { value: 'week', label: 'Weekly' },
    { value: 'month', label: 'Monthly' },
  ]

  let { initial, today, submitLabel, pending, onSubmit }: {
    initial: GoalDetail | null
    today: string
    submitLabel: string
    pending: boolean
    onSubmit: (input: GoalInput) => void
  } = $props()

  type Row = { key: string; id?: string; name: string; unit: string; target: string; weight: string; period: ComponentPeriod; autoWeight: boolean }

  const blankRow = (): Row => ({ key: crypto.randomUUID(), name: '', unit: 'reps', target: '', weight: '', period: 'day', autoWeight: true })

  function initialRows(): Row[] {
    if (!initial) return [blankRow()]
    const evenlySplit = new Set(initial.components.map((c) => c.weight)).size === 1
    return initial.components.map((c) => ({
      key: c.id,
      id: c.id,
      name: c.name,
      unit: c.unit,
      target: String(c.target),
      weight: String(c.weight),
      period: c.period,
      autoWeight: evenlySplit,
    }))
  }

  const defaults = untrack(() => ({
    name: initial?.name ?? '',
    startDate: initial?.startDate ?? today,
    endDate: initial?.endDate ?? addDays(today, DEFAULT_GOAL_DAYS - 1),
    rows: initialRows(),
  }))

  let name = $state(defaults.name)
  let startDate = $state(defaults.startDate)
  let endDate = $state(defaults.endDate)
  let rows = $state(defaults.rows)
  let removedComponentIds = $state<string[]>([])
  const totalWeight = $derived(rows.reduce((sum, row) => sum + (Number(row.weight) || 0), 0))

  function splitRemainder() {
    const auto = rows.filter((row) => row.autoWeight)
    const fixed = rows.filter((row) => !row.autoWeight).reduce((sum, row) => sum + (Number(row.weight) || 0), 0)
    const each = fixed < WHOLE_GOAL ? (WHOLE_GOAL - fixed) / auto.length : WHOLE_GOAL / rows.length
    for (const row of auto) row.weight = String(Math.max(MIN_SHARE, Math.round(each * 100) / 100))
  }
  splitRemainder()

  function addRow() {
    rows.push(blankRow())
    splitRemainder()
  }

  function removeRow(index: number) {
    const [row] = rows.splice(index, 1)
    if (row.id) removedComponentIds.push(row.id)
    splitRemainder()
  }

  function setWeight(row: Row, value: string) {
    row.weight = value
    row.autoWeight = false
    splitRemainder()
  }

  function splitEvenly() {
    for (const row of rows) row.autoWeight = true
    splitRemainder()
  }

  let list: HTMLElement
  let dragKey = $state<string | null>(null)
  let dragOffset = $state(0)
  let dragOrigin = 0
  let dragPointer = -1

  function moveRow(from: number, to: number) {
    const [row] = rows.splice(from, 1)
    rows.splice(to, 0, row)
  }

  function startDrag(event: PointerEvent & { currentTarget: HTMLElement }, row: Row) {
    if (dragKey) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragPointer = event.pointerId
    dragKey = row.key
    dragOrigin = event.clientY
    dragOffset = 0
  }

  function drag(event: PointerEvent) {
    if (!dragKey || event.pointerId !== dragPointer) return
    const index = rows.findIndex((row) => row.key === dragKey)
    const elements = [...list.querySelectorAll<HTMLElement>('[data-row]')]
    const [previous, current, next] = [elements[index - 1], elements[index], elements[index + 1]]
    const offset = event.clientY - dragOrigin
    const down = next ? next.offsetTop + next.offsetHeight - (current.offsetTop + current.offsetHeight) : 0
    const up = previous ? current.offsetTop - previous.offsetTop : 0
    if (next && offset > down / 2) {
      dragOrigin += down
      moveRow(index, index + 1)
    } else if (previous && offset < -up / 2) {
      dragOrigin -= up
      moveRow(index, index - 1)
    } else {
      const [first, last] = [elements[0], elements.at(-1)!]
      const highest = first.offsetTop - current.offsetTop
      const lowest = last.offsetTop + last.offsetHeight - (current.offsetTop + current.offsetHeight)
      dragOffset = Math.min(lowest, Math.max(highest, offset))
      return
    }
    dragOffset = event.clientY - dragOrigin
  }

  function endDrag(event: PointerEvent) {
    if (event.pointerId !== dragPointer) return
    dragPointer = -1
    dragKey = null
    dragOffset = 0
  }

  async function nudge(event: KeyboardEvent, index: number) {
    const to = index + (event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0)
    if (to === index || to < 0 || to >= rows.length) return
    event.preventDefault()
    const key = rows[index].key
    moveRow(index, to)
    await tick()
    list.querySelector<HTMLElement>(`[data-handle="${key}"]`)?.focus()
  }

  function submit(event: SubmitEvent) {
    event.preventDefault()
    onSubmit({
      name: name.trim(),
      startDate,
      endDate,
      components: rows.map((row) => ({
        id: row.id,
        name: row.name.trim(),
        unit: row.unit.trim(),
        target: Number(row.target),
        weight: Number(row.weight),
        period: row.period,
      })),
      removedComponentIds: [...removedComponentIds],
    })
  }
</script>

<form class="flex flex-col gap-6" onsubmit={submit}>
  <div class="flex flex-col gap-2">
    <Label for="goal-name">Goal name</Label>
    <Input id="goal-name" placeholder="December challenge" maxlength={LIMITS.name} bind:value={name} required />
  </div>

  <div class="grid grid-cols-2 gap-3">
    <div class="flex min-w-0 flex-col gap-2">
      <Label for="goal-start">Starts</Label>
      <Input id="goal-start" type="date" bind:value={startDate} required />
    </div>
    <div class="flex min-w-0 flex-col gap-2">
      <Label for="goal-end">Ends</Label>
      <Input id="goal-end" type="date" min={startDate} max={isIsoDate(startDate) ? addDays(startDate, LIMITS.goalDays - 1) : undefined} bind:value={endDate} required />
    </div>
  </div>

  <div class="flex flex-col gap-3">
    <div class="flex items-end justify-between gap-2">
      <div>
        <h3 class="text-sm font-medium">Components</h3>
        <p class="text-xs text-muted-foreground">Each component is worth a share of the goal. Its personal goal sets how often each member's target resets. Drag to reorder.</p>
      </div>
      <Button variant="outline" size="sm" onclick={splitEvenly}>
        <ScaleIcon />
        Split evenly
      </Button>
    </div>

    <p id="reorder-help" class="sr-only">Drag, or press the up and down arrow keys, to move this component.</p>
    <div class="flex flex-col gap-3" bind:this={list}>
      {#each rows as row, index (row.key)}
        <div
          data-row
          class={cn('relative flex flex-col gap-3 rounded-[16px] bg-secondary/60 p-3', dragKey === row.key ? 'z-10 bg-secondary shadow-[0_12px_32px_rgb(0_0_0/0.18)]' : 'transition-transform duration-200')}
          style:transform={dragKey === row.key ? `translateY(${dragOffset}px)` : null}
          animate:flip={{ duration: dragKey === row.key || prefersReducedMotion() ? 0 : MOVE_MS }}
        >
          <div class="flex items-center gap-2">
            {#if rows.length > 1}
              <button
                type="button"
                data-handle={row.key}
                class="-ml-1 grid h-9 w-6 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:cursor-grabbing"
                aria-label="Reorder {row.name.trim() || 'component'}"
                aria-describedby="reorder-help"
                onpointerdown={(event) => startDrag(event, row)}
                onpointermove={drag}
                onpointerup={endDrag}
                onpointercancel={endDrag}
              onlostpointercapture={endDrag}
                onkeydown={(event) => nudge(event, index)}
              >
                <GripVerticalIcon class="size-4" />
              </button>
            {/if}
            <Input aria-label="Component name" placeholder="Pushups" maxlength={LIMITS.name} bind:value={row.name} required />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remove component"
              disabled={rows.length === 1}
              onclick={() => removeRow(index)}
            >
              <Trash2Icon />
            </Button>
          </div>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div class="flex flex-col gap-1">
              <Label class="text-xs text-muted-foreground" for="target-{row.key}">Target</Label>
              <Input
                id="target-{row.key}"
                type="number"
                inputmode="decimal"
                min="0"
                step="any"
                value={row.target}
                oninput={(e) => (row.target = e.currentTarget.value)}
                required
              />
            </div>
            <div class="flex flex-col gap-1">
              <Label class="text-xs text-muted-foreground" for="unit-{row.key}">Unit</Label>
              <Input id="unit-{row.key}" maxlength={LIMITS.unit} bind:value={row.unit} required />
            </div>
            <div class="flex flex-col gap-1">
              <Label class="text-xs text-muted-foreground" for="weight-{row.key}">% of goal</Label>
              <Input
                id="weight-{row.key}"
                type="number"
                inputmode="decimal"
                min="0"
                step="any"
                value={row.weight}
                oninput={(e) => setWeight(row, e.currentTarget.value)}
                required
              />
            </div>
            <div class="flex flex-col gap-1">
              <Label class="text-xs text-muted-foreground" for="period-{row.key}">Personal goal</Label>
              <select
                id="period-{row.key}"
                class="h-11 w-full min-w-0 rounded-xl border border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
                bind:value={row.period}
              >
                {#each PERIOD_OPTIONS as option (option.value)}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            </div>
          </div>
          {#if row.unit.trim()}
            <p class="text-xs text-muted-foreground">Shows as {formatAmount(1, row.unit.trim())} · {formatAmount(Number(row.target) > 1 ? Number(row.target) : 10, row.unit.trim())}</p>
          {/if}
        </div>
      {/each}
    </div>

    {#if rows.length < LIMITS.components}
      <Button variant="outline" onclick={addRow}>
        <PlusIcon />
        Add component
      </Button>
    {/if}
  </div>

  {#if Math.abs(totalWeight - WHOLE_GOAL) >= 0.1}
    <p class="text-xs text-muted-foreground">
      The shares add up to {formatNumber(Math.round(totalWeight * 100) / 100)}%. Each component counts in proportion to its share.
    </p>
  {/if}

  {#if initial}
    <p class="text-xs text-muted-foreground">Removing a component also deletes everything logged against it.</p>
  {/if}

  <Button type="submit" size="lg" class="h-12" disabled={pending}>{pending ? 'Saving…' : submitLabel}</Button>
</form>
