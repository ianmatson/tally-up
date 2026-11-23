import pluralize from 'pluralize'
import { formatNumber } from './format'

const MAX_ABBREVIATION_LENGTH = 2
const FIXED_UNITS = new Set(['min', 'cal', 'kcal'])
const SINGULAR = 1
const PLURAL = 2

const isFixed = (unit: string) => unit.length <= MAX_ABBREVIATION_LENGTH || /\s/.test(unit) || FIXED_UNITS.has(unit.toLowerCase())

export const unitFor = (unit: string, amount: number) => (isFixed(unit) ? unit : pluralize(unit, amount))

export const unitSingular = (unit: string) => unitFor(unit, SINGULAR)

export const unitPlural = (unit: string) => unitFor(unit, PLURAL)

export const formatAmount = (amount: number, unit: string) => `${formatNumber(amount)} ${unitFor(unit, amount)}`
