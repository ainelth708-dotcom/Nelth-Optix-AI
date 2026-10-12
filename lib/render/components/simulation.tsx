'use client'

import { useState } from 'react'

import type { ComponentFn } from '@json-render/react'

import type { CatalogType } from './shared'

export const Simulation: ComponentFn<CatalogType, 'Simulation'> = ({
  props
}) => {
  const [value, setValue] = useState(props.initialValue)
  const result =
    props.operation === 'square'
      ? value ** 2
      : props.operation === 'cube'
        ? value ** 3
        : value * (props.factor ?? 0)
  const output = Number.isFinite(result) ? Number(result.toFixed(4)) : '—'

  return (
    <section className="my-3 grid gap-3 rounded-lg border p-4">
      <div>
        <h3 className="text-sm font-semibold">{props.title}</h3>
        {props.description && (
          <p className="mt-1 text-sm text-muted-foreground">
            {props.description}
          </p>
        )}
      </div>
      <label className="grid gap-2 text-sm">
        <span>
          Input: {value}
          {props.unit ? ` ${props.unit}` : ''}
        </span>
        <input
          type="range"
          min={props.min}
          max={props.max}
          step={props.step}
          value={value}
          onChange={event => setValue(Number(event.target.value))}
          className="w-full accent-primary"
        />
      </label>
      <p className="rounded-md bg-muted/50 p-3 text-sm" aria-live="polite">
        <span className="font-medium">{props.outputLabel}: </span>
        {output}
        {props.unit ? ` ${props.unit}` : ''}
      </p>
    </section>
  )
}
