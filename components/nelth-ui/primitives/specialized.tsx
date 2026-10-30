'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import {
  Clock,
  MapPin,
  Star,
  CheckCircle2,
  XCircle,
  Calendar
} from 'lucide-react'
import type {
  TimelineProps,
  ItineraryProps,
  ProductCardProps,
  TaskBoardProps
} from '@/lib/nelth-ui/types'
import { useNelthUI } from '../context'

// -------------------------------------------------------------
// Timeline
// -------------------------------------------------------------
export function TimelineComponent({ props }: { props: TimelineProps }) {
  return (
    <div className="my-3 w-full">
      {props.title && (
        <h4 className="text-sm font-semibold tracking-tight text-foreground mb-3">
          {props.title}
        </h4>
      )}
      <div className="space-y-4 pl-3 relative border-l-2 border-border/70 ml-2">
        {props.items.map((event, idx) => {
          const isDone = event.status === 'done'
          const isActive = event.status === 'active'

          return (
            <div key={idx} className="relative group">
              {/* Status node */}
              <div
                className={cn(
                  'absolute -left-[19px] top-1 w-3.5 h-3.5 rounded-full border-2 bg-background transition-colors',
                  isDone && 'border-emerald-500 bg-emerald-500',
                  isActive && 'border-primary bg-primary animate-pulse',
                  !isDone && !isActive && 'border-muted-foreground/60'
                )}
              />

              <div className="rounded-xl border border-border/50 bg-card/60 p-3.5 backdrop-blur-sm space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground text-sm">
                    {event.title}
                  </span>
                  <span className="text-muted-foreground font-mono text-[11px]">
                    {event.date}
                  </span>
                </div>
                {event.description && (
                  <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed">
                    {event.description}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// Itinerary (Travel Planning)
// -------------------------------------------------------------
export function ItineraryComponent({ props }: { props: ItineraryProps }) {
  return (
    <div className="my-3 w-full space-y-4">
      {props.title && (
        <h4 className="text-sm font-semibold tracking-tight text-foreground">
          {props.title}
        </h4>
      )}
      {props.days.map((day, dIdx) => (
        <div
          key={dIdx}
          className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden shadow-xs"
        >
          {/* Day header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b border-border/50">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="font-bold text-foreground text-sm">
                Jour {day.day} : {day.title}
              </span>
            </div>
          </div>

          {/* Activities / Events */}
          <div className="p-4 space-y-3">
            {day.events.map((act, aIdx) => (
              <div
                key={aIdx}
                className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors"
              >
                {act.time && (
                  <div className="flex items-center gap-1 text-[11px] font-mono font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md shrink-0">
                    <Clock className="w-3 h-3" />
                    {act.time}
                  </div>
                )}
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs sm:text-sm text-foreground">
                      {act.title}
                    </span>
                    {act.location && (
                      <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                        <MapPin className="w-3 h-3 text-rose-500/80" />
                        {act.location}
                      </span>
                    )}
                    {act.cost && (
                      <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded ml-auto">
                        {act.cost}
                      </span>
                    )}
                  </div>
                  {act.description && (
                    <p className="text-xs text-foreground/80 leading-relaxed">
                      {act.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// -------------------------------------------------------------
// Product Card
// -------------------------------------------------------------
export function ProductCardComponent({ props }: { props: ProductCardProps }) {
  const { dispatchAction } = useNelthUI()

  return (
    <div className="my-3 w-full rounded-xl border border-border/60 bg-card/70 backdrop-blur-sm p-4 space-y-3 shadow-xs hover:border-border transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-base font-bold text-foreground">{props.name}</h4>
            {props.badge && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {props.badge}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          {props.price && (
            <span className="text-lg font-extrabold text-foreground">
              {props.price}
            </span>
          )}
          {props.rating != null && (
            <div className="flex items-center gap-1 text-xs font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
              <Star className="w-3.5 h-3.5 fill-amber-500" />
              <span>{props.rating.toFixed(1)}</span>
            </div>
          )}
        </div>
      </div>

      {props.image && (
        <div className="w-full h-40 overflow-hidden rounded-lg bg-muted/20 border border-border/40">
          <img
            src={props.image}
            alt={props.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Specs Grid */}
      {props.specs && props.specs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/40 text-xs">
          {props.specs.map((s, idx) => (
            <div key={idx} className="space-y-0.5">
              <span className="text-[11px] text-muted-foreground block">{s.label}</span>
              <span className="font-semibold text-foreground/90 block truncate">
                {s.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Pros & Cons */}
      {(props.pros || props.cons) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
          {props.pros && props.pros.length > 0 && (
            <div className="space-y-1">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 block">
                Points forts
              </span>
              <ul className="space-y-0.5 text-foreground/80">
                {props.pros.map((p, idx) => (
                  <li key={idx} className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {props.cons && props.cons.length > 0 && (
            <div className="space-y-1">
              <span className="font-semibold text-rose-600 dark:text-rose-400 block">
                Points faibles
              </span>
              <ul className="space-y-0.5 text-foreground/80">
                {props.cons.map((c, idx) => (
                  <li key={idx} className="flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Action / Link */}
      {(props.link || props.actionLabel) && (
        <div className="pt-1 flex justify-end">
          {props.link ? (
            <a
              href={props.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {props.actionLabel || 'Voir le produit'}
            </a>
          ) : (
            <button
              onClick={() => {
                if (props.actionId) dispatchAction(props.actionId, { product: props.name })
              }}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
            >
              {props.actionLabel || 'Sélectionner'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// -------------------------------------------------------------
// Task Board (Planning Kanban)
// -------------------------------------------------------------
export function TaskBoardComponent({ props }: { props: TaskBoardProps }) {
  return (
    <div className="my-3 w-full">
      {props.title && (
        <h4 className="text-sm font-semibold tracking-tight text-foreground mb-3">
          {props.title}
        </h4>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {props.columns.map((col, cIdx) => (
          <div
            key={col.id || cIdx}
            className="rounded-xl border border-border/60 bg-card/50 p-3 space-y-2.5 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <span className="font-semibold text-xs tracking-tight text-foreground">
                {col.title}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.2 rounded-full">
                {col.tasks.length}
              </span>
            </div>

            <div className="space-y-2">
              {col.tasks.map((task, tIdx) => (
                <div
                  key={task.id || tIdx}
                  className="p-2.5 rounded-lg border border-border/50 bg-background/80 shadow-2xs space-y-1 hover:border-border transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-xs text-foreground">
                      {task.title}
                    </span>
                    {task.priority && (
                      <span
                        className={cn(
                          'text-[9px] font-bold uppercase px-1.5 py-0.2 rounded',
                          task.priority === 'high' && 'bg-rose-500/10 text-rose-500',
                          task.priority === 'medium' && 'bg-amber-500/10 text-amber-500',
                          task.priority === 'low' && 'bg-muted text-muted-foreground'
                        )}
                      >
                        {task.priority}
                      </span>
                    )}
                  </div>
                  {task.tag && (
                    <span className="inline-block text-[10px] text-muted-foreground bg-muted px-1.5 py-0.2 rounded">
                      {task.tag}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
