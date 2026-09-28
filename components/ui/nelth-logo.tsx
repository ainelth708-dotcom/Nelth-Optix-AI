'use client'

import { cn } from '@/lib/utils'

/** Single source of truth for the Nelth mark — also used by the
    client-side logo stamping (lib/imagine/add-logo.ts). Keep in sync. */
export const NELTH_LOGO_PATH =
  'M380 85.5c-.8.7-6.9 5.3-13.5 10-33.7 24.3-107.8 79.8-108.2 81.1-.4 1.1 14.6 9.6 47.7 27.1l18.5 9.8.3 40.5c.1 22.2-.1 40.7-.6 41.2-.4.4-6.6-2.8-13.7-7.1-39.9-24-52.5-31.2-53.5-30.6-.6.4-1 11.8-1 33.4 0 32.7 0 32.8 2.3 34.8 2.5 2.4 6.9 5.1 21.7 13.8 5.8 3.4 17.6 10.5 26.3 15.8 19.9 12.2 23.9 14.3 31.5 15.8 14.7 3.1 33-5.4 40.9-18.8 5.5-9.4 5.3-4.5 5.3-141.6 0-132.7.1-129.4-4-125.2m-225.9 45c-12.4 3.5-20.9 10.6-26.4 22.3l-3.2 6.7-.1 128.8c-.2 113.3 0 128.8 1.3 128.3 1.8-.7 16.9-11.6 33.6-24.1 6.5-5 21.7-16.1 33.6-24.8 40.9-29.8 57.1-41.9 57.1-42.8 0-1.4-5.4-4.5-34.5-19.9-14.8-7.9-28-14.9-29.1-15.6-2-1.2-2.2-2.3-2.9-27.3-.8-29.7.1-56.1 1.9-56.1.7 0 4.5 2.1 8.6 4.7 19.8 12.5 56.6 34.1 57.2 33.7.5-.3.8-15.5.8-33.9v-33.3l-3-2.6c-4.7-3.9-66.6-40.6-72-42.7-6.9-2.6-16.4-3.2-22.9-1.4'

type NelthLogoProps = React.ComponentProps<'svg'> & {
  /**
   * idle   -> draw, fill, hold 20s, then repeat forever (chrome / login)
   * active -> infinite alternate draw+fill while the AI is responding
   */
  variant?: 'idle' | 'active'
  /** For the active variant: when false the logo settles into its filled state */
  animate?: boolean
}

export function NelthLogo({
  variant = 'idle',
  animate = true,
  className,
  ...props
}: NelthLogoProps) {
  const pathClassName =
    variant === 'active'
      ? cn('nelth-logo-active', !animate && 'nelth-logo-paused')
      : 'nelth-logo-idle'

  const style =
    variant === 'active'
      ? `
        .nelth-logo-active {
          fill: none;
          stroke: currentColor;
          stroke-width: 7;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 1800;
          stroke-dashoffset: 1800;
          animation:
            nelthDraw 1.5s cubic-bezier(.65,0,.35,1) infinite alternate,
            nelthFill 0.5s ease 1.2s infinite alternate;
        }
        .nelth-logo-active.nelth-logo-paused {
          stroke-dashoffset: 0;
          fill: currentColor;
          stroke: currentColor;
          animation: none;
        }
        @keyframes nelthDraw {
          0% { stroke-dashoffset: 1800; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes nelthFill {
          0%, 20% { fill: transparent; stroke: currentColor; }
          80%, 100% { fill: currentColor; stroke: currentColor; }
        }
      `
      : `
        .nelth-logo-idle {
          fill: none;
          stroke: currentColor;
          stroke-width: 7;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 1800;
          stroke-dashoffset: 1800;
          animation: nelthIdle 23.8s linear infinite;
        }
        @keyframes nelthIdle {
          0% { stroke-dashoffset: 1800; fill: transparent; }
          12.6% { stroke-dashoffset: 0; fill: transparent; }
          15.9% { fill: currentColor; stroke: currentColor; }
          100% { fill: currentColor; stroke: currentColor; }
        }
      `

  return (
    <svg
      viewBox="0 0 497 502"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('size-4', className)}
      {...props}
    >
      <style>{style}</style>
      <path className={pathClassName} d={NELTH_LOGO_PATH} />
    </svg>
  )
}
