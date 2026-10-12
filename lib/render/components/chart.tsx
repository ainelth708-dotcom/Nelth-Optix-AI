'use client'

import { useId, useState } from 'react'

import type { ComponentFn } from '@json-render/react'

import type { CatalogType } from './shared'

const WIDTH = 640
const HEIGHT = 280
const PADDING = { top: 20, right: 20, bottom: 20, left: 20 }

export const Chart: ComponentFn<CatalogType, 'Chart'> = ({ props }) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const chartTitleId = useId()
  const values = props.values
  const min = Math.min(0, ...values.map(point => point.value))
  const max = Math.max(0, ...values.map(point => point.value))
  const span = max - min || 1
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom
  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const baselineY = PADDING.top + (max / span) * plotHeight
  const points = values.map((point, index) => ({
    ...point,
    x: PADDING.left + (plotWidth * (index + 0.5)) / values.length,
    y: PADDING.top + ((max - point.value) / span) * plotHeight
  }))
  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')

  return (
    <section className="my-3 rounded-lg border p-3" aria-label={props.title}>
      <h3 className="mb-2 text-sm font-semibold">{props.title}</h3>
      <div className="w-full overflow-hidden">
        <svg
          className="h-auto w-full"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-labelledby={chartTitleId}
          preserveAspectRatio="xMidYMid meet"
        >
          <title id={chartTitleId}>{props.title}</title>
          <line
            x1={PADDING.left}
            x2={WIDTH - PADDING.right}
            y1={baselineY}
            y2={baselineY}
            className="stroke-border"
            strokeWidth="2"
          />
          {props.chartType === 'bar' ? (
            points.map((point, index) => {
              const zeroY = baselineY
              const barWidth = Math.min(36, plotWidth / values.length / 2)
              const y = Math.min(point.y, zeroY)
              const height = Math.max(2, Math.abs(zeroY - point.y))
              return (
                <rect
                  key={`${point.label}-${index}`}
                  x={point.x - barWidth / 2}
                  y={y}
                  width={barWidth}
                  height={height}
                  rx="4"
                  className={
                    selectedIndex === index ? 'fill-primary' : 'fill-primary/55'
                  }
                >
                  <title>{`${point.label}: ${point.value}`}</title>
                </rect>
              )
            })
          ) : (
            <>
              <path
                d={linePath}
                fill="none"
                className="stroke-primary"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {points.map((point, index) => (
                <circle
                  key={`${point.label}-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r={selectedIndex === index ? 7 : 5}
                  className="fill-primary"
                >
                  <title>{`${point.label}: ${point.value}`}</title>
                </circle>
              ))}
            </>
          )}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap gap-2" aria-label="Chart data points">
        {points.map((point, index) => (
          <button
            key={`${point.label}-${index}`}
            type="button"
            aria-pressed={selectedIndex === index}
            onClick={() => setSelectedIndex(index)}
            className="rounded-md border px-2 py-1 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {point.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm" aria-live="polite">
        {points[selectedIndex].label}: {points[selectedIndex].value}
      </p>
    </section>
  )
}
