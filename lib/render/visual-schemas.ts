import { z } from 'zod'

export const tablePropsSchema = z
  .object({
    title: z.string().max(120).optional(),
    columns: z.array(z.string().min(1).max(80)).min(1).max(8),
    rows: z.array(z.array(z.string().max(300))).max(30)
  })
  .refine(
    value => value.rows.every(row => row.length === value.columns.length),
    'Each table row must have one cell per column'
  )

export const chartPropsSchema = z.object({
  title: z.string().min(1).max(120),
  chartType: z.enum(['bar', 'line']),
  values: z
    .array(
      z.object({
        label: z.string().min(1).max(40),
        value: z.number().finite().min(-1_000_000_000).max(1_000_000_000)
      })
    )
    .min(1)
    .max(16)
})

export const diagramPropsSchema = z.object({
  title: z.string().min(1).max(120),
  steps: z
    .array(
      z.object({
        label: z.string().min(1).max(100),
        description: z.string().max(240).optional()
      })
    )
    .min(2)
    .max(12)
})

export const calculatorPropsSchema = z.object({
  title: z.string().min(1).max(120),
  operation: z.enum(['add', 'subtract', 'multiply', 'divide', 'percentOf']),
  first: z.object({
    label: z.string().min(1).max(80),
    value: z.number().finite().min(-1_000_000_000).max(1_000_000_000)
  }),
  second: z.object({
    label: z.string().min(1).max(80),
    value: z.number().finite().min(-1_000_000_000).max(1_000_000_000)
  }),
  resultLabel: z.string().min(1).max(80)
})

export const simulationPropsSchema = z
  .object({
    title: z.string().min(1).max(120),
    description: z.string().max(240).optional(),
    operation: z.enum(['square', 'cube', 'multiply']),
    min: z.number().finite().min(-100_000).max(100_000),
    max: z.number().finite().min(-100_000).max(100_000),
    step: z.number().finite().positive().max(10_000),
    initialValue: z.number().finite().min(-100_000).max(100_000),
    factor: z.number().finite().min(-100_000).max(100_000).optional(),
    outputLabel: z.string().min(1).max(80),
    unit: z.string().max(24).optional()
  })
  .refine(
    value =>
      value.min < value.max &&
      value.initialValue >= value.min &&
      value.initialValue <= value.max &&
      (value.operation !== 'multiply' || value.factor !== undefined),
    'Simulation bounds and operation parameters are invalid'
  )

export const interactiveFormPropsSchema = z
  .object({
    title: z.string().min(1).max(120),
    submitLabel: z.string().min(1).max(60),
    fields: z
      .array(
        z.object({
          label: z.string().min(1).max(80),
          type: z.enum(['text', 'number', 'select']),
          required: z.boolean().optional(),
          options: z.array(z.string().min(1).max(80)).max(10).optional()
        })
      )
      .min(1)
      .max(10)
  })
  .refine(
    value =>
      value.fields.every(
        field => field.type !== 'select' || Boolean(field.options?.length)
      ),
    'Select fields require at least one option'
  )

export const nativeVisualElementSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('Table'), props: tablePropsSchema }),
  z.object({ type: z.literal('Chart'), props: chartPropsSchema }),
  z.object({ type: z.literal('Diagram'), props: diagramPropsSchema }),
  z.object({ type: z.literal('Calculator'), props: calculatorPropsSchema }),
  z.object({ type: z.literal('Simulation'), props: simulationPropsSchema }),
  z.object({
    type: z.literal('InteractiveForm'),
    props: interactiveFormPropsSchema
  })
])

export const nativeVisualComponentTypes: ReadonlySet<string> = new Set(
  nativeVisualElementSchema.options.map(option => option.shape.type.value)
)
