<script lang="ts">
  import PlusIcon from '@lucide/svelte/icons/plus'
  import ScaleIcon from '@lucide/svelte/icons/scale'
  import Trash2Icon from '@lucide/svelte/icons/trash-2'
  import { untrack } from 'svelte'
  import type { GoalDetail, GoalInput } from '$shared/api'
  import { addDays, isIsoDate } from '$shared/dates'
  import { LIMITS } from '$shared/limits'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { formatPoints } from '$lib/format'
  import { balancedWeight, BALANCED_COMPONENT_POINTS } from '$lib/progress'

  const DEFAULT_GOAL_DAYS = 30

  let { initial, today, submitLabel, pending, onSubmit }: {
    initial: GoalDetail | null
    today: string
    submitLabel: string
    pending: boolean
    onSubmit: (input: GoalInput) => void
  } = $props()

  type Row = { key: string; id?: string; name: string; unit: string; target: string; weight: string; autoWeight: boolean }

  const blankRow = (): Row => ({ key: crypto.randomUUID(), name: '', unit: 'reps', target: '', weight: '', autoWeight: true })

  function initialRows(): Row[] {
    if (!initial) return [blankRow()]
    return initial.components.map((c) => ({
      key: c.id,
      id: c.id,
      name: c.name,
      unit: c.unit,
      target: String(c.target),
      weight: String(c.weight),
      autoWeight: c.weight === balancedWeight(c.target),
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

  function removeRow(index: number) {
    const [row] = rows.splice(index, 1)
    if (row.id) removedComponentIds.push(row.id)
  }

  function setTarget(row: Row, value: string) {
    row.target = value
    const target = Number(value)
    if (row.autoWeight && target > 0) row.weight = String(balancedWeight(target))
  }

  function setWeight(row: Row, value: string) {
    row.weight = value
    row.autoWeight = false
  }

  function balanceAll() {
    for (const row of rows) {
      const target = Number(row.target)
      if (target > 0) {
        row.weight = String(balancedWeight(target))
        row.autoWeight = true
      }
    }
  }

  const completionPoints = (row: Row) => Number(row.target) * Number(row.weight)

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
    <div class="flex flex-col gap-2">
      <Label for="goal-start">Starts</Label>
      <Input id="goal-start" type="date" bind:value={startDate} required />
    </div>
    <div class="flex flex-col gap-2">
      <Label for="goal-end">Ends</Label>
      <Input id="goal-end" type="date" min={startDate} max={isIsoDate(startDate) ? addDays(startDate, LIMITS.goalDays - 1) : undefined} bind:value={endDate} required />
    </div>
  </div>

  <div class="flex flex-col gap-3">
    <div class="flex items-end justify-between gap-2">
      <div>
        <h3 class="text-sm font-medium">Components</h3>
        <p class="text-xs text-muted-foreground">Points per unit sets each component's value on the leaderboard.</p>
      </div>
      <Button variant="outline" size="sm" onclick={balanceAll}>
        <ScaleIcon />
        Balance
      </Button>
    </div>

    {#each rows as row, index (row.key)}
      <div class="flex flex-col gap-3 rounded-[16px] bg-secondary/60 p-3">
        <div class="flex items-center gap-2">
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
        <div class="grid grid-cols-3 gap-2">
          <div class="flex flex-col gap-1">
            <Label class="text-xs text-muted-foreground" for="target-{row.key}">Target</Label>
            <Input
              id="target-{row.key}"
              type="number"
              inputmode="decimal"
              min="0"
              step="any"
              value={row.target}
              oninput={(e) => setTarget(row, e.currentTarget.value)}
              required
            />
          </div>
          <div class="flex flex-col gap-1">
            <Label class="text-xs text-muted-foreground" for="unit-{row.key}">Unit</Label>
            <Input id="unit-{row.key}" maxlength={LIMITS.unit} bind:value={row.unit} required />
          </div>
          <div class="flex flex-col gap-1">
            <Label class="text-xs text-muted-foreground" for="weight-{row.key}">Pts / unit</Label>
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
        </div>
        {#if completionPoints(row) > 0}
          <p class="text-xs text-muted-foreground">
            Worth {formatPoints(completionPoints(row))} pts when complete
            {#if row.autoWeight}· balanced at {formatPoints(BALANCED_COMPONENT_POINTS)}{/if}
          </p>
        {/if}
      </div>
    {/each}

    {#if rows.length < LIMITS.components}
      <Button variant="outline" onclick={() => rows.push(blankRow())}>
        <PlusIcon />
        Add component
      </Button>
    {/if}
  </div>

  {#if initial}
    <p class="text-xs text-muted-foreground">Removing a component also deletes everything logged against it.</p>
  {/if}

  <Button type="submit" size="lg" class="h-12" disabled={pending}>{pending ? 'Saving…' : submitLabel}</Button>
</form>
