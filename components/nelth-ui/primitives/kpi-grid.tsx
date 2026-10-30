'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { KPIGridProps } from '@/lib/nelth-ui/types'

export function KPIGridComponent({ props }: { props: KPIGridProps }) {
  const colClasses: Record<number, string> = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4'
  }

  return (
    <div
      className={cn(
        'grid w-full gap-3 my-3',
        colClasses[props.columns || 3]
      )}
    >
      {props.items.map((item, idx) => {
        const isUp = item.trend === 'up' || (typeof item.change === 'string' && item.change.startsWith('+'))
        const isDown = item.trend === 'down' || (typeof item.change === 'string' && item.change.startsWith('-'))

        return (
          <div
            key={idx}
            className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-4 space-y-1.5 transition-all duration-200 hover:border-border"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground tracking-wide">
                {item.label}
              </span>
            </div>

            <div className="text-2xl font-bold tracking-tight text-foreground">
              {item.value}
            </div>

            {(item.change || item.caption) && (
              <div className="flex items-center gap-1.5 text-xs font-medium pt-0.5">
                {isUp && <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />}
                {isDown && <TrendingDown className="w-3.5 h-3.5 text-rose-500" />}
                {!isUp && !isDown && <Minus className="w-3.5 h-3.5 text-muted-foreground" />}
                <span
                  className={cn(
                    isUp && 'text-emerald-600 dark:text-emerald-400',
                    isDown && 'text-rose-600 dark:text-rose-400',
                    !isUp && !isDown && 'text-muted-foreground'
                  )}
                >
                  {item.change}
                </span>
                {item.caption && (
                  <span className="text-muted-foreground/80 font-normal">
                    · {item.caption}
                  </span>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
