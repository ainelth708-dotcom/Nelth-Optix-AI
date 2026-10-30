'use client'

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import type {
  BarChartProps,
  LineChartProps,
  AreaChartProps,
  PieChartProps
} from '@/lib/nelth-ui/types'

const DEFAULT_PALETTE = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316'  // orange
]

// -------------------------------------------------------------
// Bar Chart
// -------------------------------------------------------------
export function BarChartComponent({ props }: { props: BarChartProps }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const isHorizontal = !!props.horizontal
  const yKey = props.yKeys[0] || 'value'
  const xKey = props.xKey || 'label'

  // Extract numeric values
  const values = props.data.map(d => Number(d[yKey]) || 0)
  const maxVal = Math.max(...values, 1)

  const chartHeight = 220
  const chartWidth = 500
  const padBottom = 30
  const padLeft = 40
  const plotWidth = chartWidth - padLeft - 20
  const plotHeight = chartHeight - padBottom - 20

  if (isHorizontal) {
    return (
      <div className="my-3 w-full rounded-xl border border-border/60 bg-card/60 p-4 backdrop-blur-sm">
        {props.title && (
          <h4 className="text-sm font-semibold tracking-tight text-foreground mb-3">
            {props.title}
          </h4>
        )}
        <div className="space-y-2.5">
          {props.data.map((item, idx) => {
            const rawVal = Number(item[yKey]) || 0
            const label = String(item[xKey] ?? `Item ${idx + 1}`)
            const pct = Math.max(2, (rawVal / maxVal) * 100)
            const color =
              props.colors?.[idx % props.colors.length] ||
              DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length]

            return (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground/80">{label}</span>
                  <span className="font-semibold text-foreground">
                    {rawVal.toLocaleString()}{props.unit ? ` ${props.unit}` : ''}
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-muted/60 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Vertical Bar Chart (Native SVG)
  const barCount = props.data.length
  const barWidth = Math.min(36, Math.max(12, (plotWidth / Math.max(1, barCount)) * 0.65))
  const step = plotWidth / Math.max(1, barCount)

  return (
    <div className="my-3 w-full rounded-xl border border-border/60 bg-card/60 p-4 backdrop-blur-sm">
      {props.title && (
        <h4 className="text-sm font-semibold tracking-tight text-foreground mb-3">
          {props.title}
        </h4>
      )}

      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto overflow-visible"
        >
          {/* Grid lines */}
          <g className="opacity-20 stroke-current text-border">
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const y = 20 + plotHeight * (1 - ratio)
              return (
                <line
                  key={i}
                  x1={padLeft}
                  y1={y}
                  x2={chartWidth - 20}
                  y2={y}
                  strokeDasharray="3 3"
                />
              )
            })}
          </g>

          {/* Bars */}
          {props.data.map((d, i) => {
            const val = Number(d[yKey]) || 0
            const label = String(d[xKey] ?? `Item ${i + 1}`)
            const h = (val / maxVal) * plotHeight
            const x = padLeft + i * step + (step - barWidth) / 2
            const y = 20 + plotHeight - h
            const color =
              props.colors?.[i % props.colors.length] ||
              DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]
            const isHovered = hoveredIdx === i

            return (
              <g
                key={i}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={h}
                  rx={4}
                  fill={color}
                  opacity={isHovered ? 1 : 0.85}
                  className="transition-all duration-200"
                />
                {/* Category label */}
                <text
                  x={x + barWidth / 2}
                  y={chartHeight - 8}
                  textAnchor="middle"
                  className="text-[11px] fill-muted-foreground font-medium"
                >
                  {label.length > 8 ? `${label.slice(0, 7)}…` : label}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Hover Tooltip */}
        {hoveredIdx !== null && props.data[hoveredIdx] && (
          <div className="absolute top-2 right-2 rounded-lg border border-border/80 bg-background/95 px-2.5 py-1 text-xs shadow-md">
            <span className="font-medium text-muted-foreground">
              {String(props.data[hoveredIdx][xKey])}:{' '}
            </span>
            <span className="font-bold text-foreground">
              {Number(props.data[hoveredIdx][yKey]).toLocaleString()}
              {props.unit ? ` ${props.unit}` : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// Line Chart
// -------------------------------------------------------------
export function LineChartComponent({ props }: { props: LineChartProps }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const yKey = props.yKeys[0] || 'value'
  const xKey = props.xKey || 'label'

  const values = props.data.map(d => Number(d[yKey]) || 0)
  const maxVal = Math.max(...values, 1)
  const minVal = Math.min(...values, 0)

  const chartHeight = 220
  const chartWidth = 500
  const padBottom = 30
  const padLeft = 40
  const plotWidth = chartWidth - padLeft - 20
  const plotHeight = chartHeight - padBottom - 20

  const range = maxVal - minVal || 1
  const step = plotWidth / Math.max(1, props.data.length - 1)

  const points = props.data.map((d, i) => {
    const val = Number(d[yKey]) || 0
    const label = String(d[xKey] ?? `Item ${i + 1}`)
    const x = padLeft + i * step
    const y = 20 + plotHeight - ((val - minVal) / range) * plotHeight
    return { x, y, label, val }
  })

  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`
  }, '')

  const areaD = `${pathD} L ${points[points.length - 1]?.x || 0} ${20 + plotHeight} L ${points[0]?.x || 0} ${20 + plotHeight} Z`
  const lineColor = props.colors?.[0] || '#3b82f6'

  return (
    <div className="my-3 w-full rounded-xl border border-border/60 bg-card/60 p-4 backdrop-blur-sm">
      {props.title && (
        <h4 className="text-sm font-semibold tracking-tight text-foreground mb-3">
          {props.title}
        </h4>
      )}

      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto overflow-visible"
        >
          <defs>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Area gradient */}
          <path d={areaD} fill="url(#lineGrad)" />

          {/* Line stroke */}
          <path
            d={pathD}
            fill="none"
            stroke={lineColor}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points */}
          {points.map((p, i) => {
            const isHovered = hoveredIdx === i

            return (
              <g
                key={i}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {(props.dots !== false || isHovered) && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isHovered ? 6 : 4}
                    fill={isHovered ? lineColor : '#ffffff'}
                    stroke={lineColor}
                    strokeWidth={2}
                    className="transition-all duration-150"
                  />
                )}
                {/* X Axis Label */}
                <text
                  x={p.x}
                  y={chartHeight - 8}
                  textAnchor="middle"
                  className="text-[10px] fill-muted-foreground font-medium"
                >
                  {p.label.length > 7 ? `${p.label.slice(0, 6)}…` : p.label}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Hover Tooltip */}
        {hoveredIdx !== null && points[hoveredIdx] && (
          <div className="absolute top-2 right-2 rounded-lg border border-border/80 bg-background/95 px-2.5 py-1 text-xs shadow-md">
            <span className="font-medium text-muted-foreground">
              {points[hoveredIdx].label}:{' '}
            </span>
            <span className="font-bold text-foreground">
              {points[hoveredIdx].val.toLocaleString()}
              {props.unit ? ` ${props.unit}` : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// Area Chart
// -------------------------------------------------------------
export function AreaChartComponent({ props }: { props: AreaChartProps }) {
  return (
    <LineChartComponent
      props={{
        data: props.data,
        xKey: props.xKey,
        yKeys: props.yKeys,
        labels: props.labels,
        colors: props.colors || ['#10b981'],
        title: props.title,
        unit: props.unit,
        dots: true
      }}
    />
  )
}

// -------------------------------------------------------------
// Pie / Donut Chart
// -------------------------------------------------------------
export function PieChartComponent({ props }: { props: PieChartProps }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const isDonut = props.donut !== false
  const total = props.data.reduce((acc, d) => acc + d.value, 0) || 1

  const size = 200
  const center = size / 2
  const radius = center - 15
  const innerRadius = isDonut ? radius * 0.6 : 0

  let currentAngle = -Math.PI / 2

  const slices = props.data.map((d, i) => {
    const fraction = d.value / total
    const angle = fraction * 2 * Math.PI
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    currentAngle = endAngle

    const x1 = center + radius * Math.cos(startAngle)
    const y1 = center + radius * Math.sin(startAngle)
    const x2 = center + radius * Math.cos(endAngle)
    const y2 = center + radius * Math.sin(endAngle)

    const ix1 = center + innerRadius * Math.cos(endAngle)
    const iy1 = center + innerRadius * Math.sin(endAngle)
    const ix2 = center + innerRadius * Math.cos(startAngle)
    const iy2 = center + innerRadius * Math.sin(startAngle)

    const largeArc = angle > Math.PI ? 1 : 0

    const pathD = isDonut
      ? `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2} Z`
      : `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`

    return {
      ...d,
      pathD,
      fraction,
      color: d.color || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]
    }
  })

  return (
    <div className="my-3 w-full rounded-xl border border-border/60 bg-card/60 p-4 backdrop-blur-sm">
      {props.title && (
        <h4 className="text-sm font-semibold tracking-tight text-foreground mb-3">
          {props.title}
        </h4>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-around gap-4">
        {/* SVG Pie */}
        <div className="relative">
          <svg viewBox={`0 0 ${size} ${size}`} className="w-48 h-48">
            {slices.map((s, i) => {
              const isHovered = hoveredIdx === i

              return (
                <path
                  key={i}
                  d={s.pathD}
                  fill={s.color}
                  opacity={isHovered ? 1 : 0.85}
                  className="cursor-pointer transition-all duration-200 hover:scale-105 origin-center"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              )
            })}
          </svg>
          {isDonut && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] text-muted-foreground uppercase font-medium">
                Total
              </span>
              <span className="text-sm font-bold text-foreground">
                {total.toLocaleString()}{props.unit ? ` ${props.unit}` : ''}
              </span>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="space-y-1.5 w-full sm:w-auto">
          {slices.map((s, i) => {
            const pct = Math.round(s.fraction * 100)
            const isHovered = hoveredIdx === i

            return (
              <div
                key={i}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={cn(
                  'flex items-center justify-between sm:justify-start gap-3 text-xs p-1 rounded-md transition-colors cursor-pointer',
                  isHovered ? 'bg-muted' : 'hover:bg-muted/50'
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="font-medium text-foreground/80">{s.name}</span>
                </div>
                <span className="text-muted-foreground font-semibold ml-auto sm:ml-4">
                  {pct}%
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
