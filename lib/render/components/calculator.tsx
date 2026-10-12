'use client'

import { useState } from 'react'

import type { ComponentFn } from '@json-render/react'

import { Input } from '@/components/ui/input'

import type { CatalogType } from './shared'

export const Calculator: ComponentFn<CatalogType, 'Calculator'> = ({
  props
}) => {
  const [first, setFirst] = useState(String(props.first.value))
  const [second, setSecond] = useState(String(props.second.value))
  const firstValue = first.trim() === '' ? Number.NaN : Number(first)
  const secondValue = second.trim() === '' ? Number.NaN : Number(second)
  const valid = Number.isFinite(firstValue) && Number.isFinite(secondValue)
  const result =
    !valid || (props.operation === 'divide' && secondValue === 0)
      ? null
      : {
          add: () => firstValue + secondValue,
          subtract: () => firstValue - secondValue,
          multiply: () => firstValue * secondValue,
          divide: () => firstValue / secondValue,
          percentOf: () => (firstValue * secondValue) / 100
        }[props.operation]()
  const safeResult = result !== null && Number.isFinite(result) ? result : null

  return (
    <section className="my-3 rounded-lg border p-4">
      <h3 className="mb-3 text-sm font-semibold">{props.title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          {props.first.label}
          <Input
            type="number"
            inputMode="decimal"
            value={first}
            onChange={event => setFirst(event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          {props.second.label}
          <Input
            type="number"
            inputMode="decimal"
            value={second}
            onChange={event => setSecond(event.target.value)}
          />
        </label>
      </div>
      <p className="mt-4 rounded-md bg-muted/50 p-3 text-sm" aria-live="polite">
        <span className="font-medium">{props.resultLabel}: </span>
        {safeResult === null
          ? props.operation === 'divide' &&
            Number.isFinite(secondValue) &&
            secondValue === 0
            ? 'Division par zéro impossible.'
            : 'Saisissez deux nombres valides.'
          : Number(safeResult.toFixed(6)).toLocaleString()}
      </p>
    </section>
  )
}
