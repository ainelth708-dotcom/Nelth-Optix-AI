'use client'

import type { ComponentFn } from '@json-render/react'
import { IconArrowDown } from '@tabler/icons-react'

import type { CatalogType } from './shared'

export const Diagram: ComponentFn<CatalogType, 'Diagram'> = ({ props }) => (
  <section className="my-3 rounded-lg border p-3" aria-label={props.title}>
    <h3 className="mb-3 text-sm font-semibold">{props.title}</h3>
    <ol className="mx-auto flex max-w-xl flex-col items-stretch">
      {props.steps.map((step, index) => (
        <li
          key={`${step.label}-${index}`}
          className="flex flex-col items-center"
        >
          <div className="w-full rounded-lg border bg-card px-4 py-3 text-center shadow-sm">
            <p className="font-medium">{step.label}</p>
            {step.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {step.description}
              </p>
            )}
          </div>
          {index < props.steps.length - 1 && (
            <IconArrowDown
              aria-hidden="true"
              className="my-1 size-5 text-muted-foreground"
            />
          )}
        </li>
      ))}
    </ol>
  </section>
)
