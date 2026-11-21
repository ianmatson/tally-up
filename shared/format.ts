const preciseFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
const wholeFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })
const WHOLE_NUMBER_THRESHOLD = 100

export const formatNumber = (n: number) => (Math.abs(n) >= WHOLE_NUMBER_THRESHOLD ? wholeFormat : preciseFormat).format(n)

export const firstName = (name: string) => name.split(' ')[0]
