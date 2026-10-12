import { z } from 'zod'

import { schema } from './schema'
import {
  calculatorPropsSchema,
  chartPropsSchema,
  diagramPropsSchema,
  interactiveFormPropsSchema,
  simulationPropsSchema,
  tablePropsSchema
} from './visual-schemas'

const iconName = z.enum(['related', 'arrow-right']).optional()

export const catalog = schema.createCatalog({
  components: {
    Heading: {
      props: z.object({
        title: z.string(),
        icon: iconName
      }),
      description: 'A heading label with an optional icon'
    },
    Stack: {
      props: z
        .object({
          direction: z.enum(['vertical', 'horizontal']).optional(),
          gap: z.enum(['xs', 'sm', 'md', 'lg']).optional()
        })
        .partial(),
      description:
        'A layout container that stacks children vertically or horizontally'
    },
    Button: {
      props: z.object({
        text: z.string(),
        icon: iconName,
        variant: z
          .enum(['default', 'outline', 'ghost', 'link', 'secondary'])
          .optional()
      }),
      description:
        'A clickable button that emits a press action. Use variant="link" with icon="arrow-right" for inline follow-up suggestions.'
    },
    Grid: {
      props: z.object({
        columns: z.union([
          z.literal(1),
          z.literal(2),
          z.literal(3),
          z.literal(4)
        ]),
        gap: z.enum(['xs', 'sm', 'md', 'lg']).optional()
      }),
      description:
        'A fixed-column CSS grid container. Used to lay out images so that cell widths are determined upfront.'
    },
    Image: {
      props: z.object({
        src: z.string(),
        sourceUrl: z.string().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        aspectRatio: z.enum(['1:1', '16:9', '4:3']).optional()
      }),
      description:
        'An inline image referencing a web source; click to expand with credit'
    },
    Table: {
      props: tablePropsSchema,
      description:
        'A compact responsive data table with validated columns and rows'
    },
    Chart: {
      props: chartPropsSchema,
      description:
        'An interactive, accessible bar or line chart for supplied numeric data'
    },
    Diagram: {
      props: diagramPropsSchema,
      description: 'A responsive, ordered flow diagram made from labeled steps'
    },
    Calculator: {
      props: calculatorPropsSchema,
      description:
        'A two-input calculator with a fixed safe arithmetic operation'
    },
    Simulation: {
      props: simulationPropsSchema,
      description:
        'A bounded slider simulation for square, cube, or fixed-factor relationships'
    },
    InteractiveForm: {
      props: interactiveFormPropsSchema,
      description:
        'A validated local form whose explicit submit sends its answers as a chat follow-up'
    }
  },
  actions: {
    submitQuery: {
      params: z.object({
        query: z.string()
      }),
      description: 'Submit a follow-up query to the chat'
    }
  }
})
