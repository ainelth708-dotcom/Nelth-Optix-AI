'use client'

import React, { Component, type ErrorInfo } from 'react'
import type { NelthUIComponentNode } from '@/lib/nelth-ui/types'
import {
  StackComponent,
  RowComponent,
  GridComponent,
  CardComponent,
  ContainerComponent,
  DividerComponent,
  SectionComponent,
  TabsComponent
} from './primitives/layout'
import {
  HeadingComponent,
  TextComponent,
  BadgeComponent,
  CalloutComponent,
  ListComponent,
  CodeComponent,
  StatComponent,
  ImageComponent
} from './primitives/content'
import { DataTableComponent } from './primitives/data-table'
import { KPIGridComponent } from './primitives/kpi-grid'
import {
  BarChartComponent,
  LineChartComponent,
  AreaChartComponent,
  PieChartComponent
} from './primitives/charts'
import { ComparisonMatrixComponent } from './primitives/comparison'
import {
  ButtonComponent,
  InputComponent,
  SelectComponent,
  SliderComponent,
  CheckboxComponent,
  FormComponent,
  FilterBarComponent
} from './primitives/interactive'
import {
  TimelineComponent,
  ItineraryComponent,
  ProductCardComponent,
  TaskBoardComponent
} from './primitives/specialized'

interface ErrorBoundaryProps {
  children: React.ReactNode
  componentName?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

export class NelthUIErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[NelthUI] Error rendering component <${this.props.componentName}>:`, error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 my-2 text-xs text-amber-700 dark:text-amber-300">
          <span className="font-semibold">Composant non affiché :</span> {this.props.componentName || 'élément'} (données invalides)
        </div>
      )
    }
    return this.props.children
  }
}

export function NelthUINodeRenderer({ node }: { node: NelthUIComponentNode }) {
  if (!node || !node.component) return null

  const children = Array.isArray(node.children)
    ? node.children.map(child => <NelthUINodeRenderer key={child.id} node={child} />)
    : null

  const renderComponent = () => {
    switch (node.component) {
      // Layout
      case 'stack':
        return <StackComponent props={node.props as any}>{children}</StackComponent>
      case 'row':
        return <RowComponent props={node.props as any}>{children}</RowComponent>
      case 'grid':
        return <GridComponent props={node.props as any}>{children}</GridComponent>
      case 'card':
        return <CardComponent id={node.id} props={node.props as any}>{children}</CardComponent>
      case 'container':
        return <ContainerComponent props={node.props as any}>{children}</ContainerComponent>
      case 'divider':
        return <DividerComponent props={node.props as any} />
      case 'section':
        return <SectionComponent props={node.props as any}>{children}</SectionComponent>
      case 'tabs':
        return <TabsComponent id={node.id} props={node.props as any}>{children}</TabsComponent>

      // Content
      case 'heading':
        return <HeadingComponent props={node.props as any} />
      case 'text':
        return <TextComponent props={node.props as any} />
      case 'badge':
        return <BadgeComponent props={node.props as any} />
      case 'callout':
        return <CalloutComponent props={node.props as any} />
      case 'list':
        return <ListComponent props={node.props as any} />
      case 'code':
        return <CodeComponent props={node.props as any} />
      case 'stat':
        return <StatComponent props={node.props as any} />
      case 'image':
        return <ImageComponent props={node.props as any} />

      // Data
      case 'table':
        return <DataTableComponent id={node.id} props={node.props as any} />
      case 'kpi_grid':
        return <KPIGridComponent props={node.props as any} />

      // Charts
      case 'bar_chart':
        return <BarChartComponent props={node.props as any} />
      case 'line_chart':
        return <LineChartComponent props={node.props as any} />
      case 'area_chart':
        return <AreaChartComponent props={node.props as any} />
      case 'pie_chart':
        return <PieChartComponent props={node.props as any} />

      // Comparison
      case 'comparison':
        return <ComparisonMatrixComponent props={node.props as any} />

      // Interactive
      case 'button':
        return <ButtonComponent id={node.id} props={node.props as any} />
      case 'input':
        return <InputComponent id={node.id} props={node.props as any} />
      case 'select':
        return <SelectComponent id={node.id} props={node.props as any} />
      case 'slider':
        return <SliderComponent id={node.id} props={node.props as any} />
      case 'checkbox':
        return <CheckboxComponent id={node.id} props={node.props as any} />
      case 'form':
        return <FormComponent id={node.id} props={node.props as any}>{children}</FormComponent>
      case 'filter_bar':
        return <FilterBarComponent id={node.id} props={node.props as any} />

      // Specialized
      case 'timeline':
        return <TimelineComponent props={node.props as any} />
      case 'itinerary':
        return <ItineraryComponent props={node.props as any} />
      case 'product_card':
        return <ProductCardComponent props={node.props as any} />
      case 'task_board':
        return <TaskBoardComponent props={node.props as any} />

      default:
        console.warn(`[NelthUI] Unknown component type: ${(node as any).component}`)
        return null
    }
  }

  return (
    <NelthUIErrorBoundary componentName={node.component}>
      {renderComponent()}
    </NelthUIErrorBoundary>
  )
}

