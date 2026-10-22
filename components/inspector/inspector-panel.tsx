'use client'

import {
  IconBulb as LightbulbIcon,
  IconListCheck as ListTodo,
  IconMessage as MessageSquare,
  IconSearch as Search,
  IconX as X
} from '@tabler/icons-react'

import { TooltipProvider } from '@/components/ui/tooltip'
import { TooltipButton } from '@/components/ui/tooltip-button'

import { ArtifactContent } from '@/components/artifact/artifact-content'
import { useArtifact } from '@/components/artifact/artifact-context'

export function InspectorPanel() {
  const { state, close } = useArtifact()
  const part = state.part
  if (!part) return null

  // Get the icon and title based on part type
  const getIconAndTitle = () => {
    switch (part.type) {
      case 'tool-search':
      case 'tool-askQuestion': {
        const toolName = part.type.replace('tool-', '')
        return {
          icon: <Search size={16} />,
          title: toolName === 'search' ? 'Sources' : toolName
        }
      }
      case 'tool-todoWrite':
        return {
          icon: <ListTodo size={16} />,
          title: 'Todo List'
        }
      case 'reasoning':
        return {
          icon: <LightbulbIcon size={16} />,
          title: 'Thoughts'
        }
      case 'text':
        return {
          icon: <MessageSquare size={16} />,
          title: 'Text'
        }
      default:
        return {
          icon: <MessageSquare size={16} />,
          title: 'Content'
        }
    }
  }

  const { icon, title } = getIconAndTitle()

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col overflow-hidden bg-background">
        {/* Flat header, the way a side panel reads: title on the left, close
            on the right. No floating card, no gutter. */}
        <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border/60 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-muted-foreground">{icon}</span>
            <h3 className="truncate text-sm font-medium text-foreground">
              {title}
            </h3>
          </div>
          <TooltipButton
            variant="ghost"
            size="icon"
            onClick={close}
            aria-label="Close panel"
            tooltipContent="Close"
            className="size-8 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </TooltipButton>
        </div>
        <div
          data-vaul-no-drag
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4"
        >
          <ArtifactContent part={part} />
        </div>
      </div>
    </TooltipProvider>
  )
}
