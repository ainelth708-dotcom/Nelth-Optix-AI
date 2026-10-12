'use client'

import { defineRegistry } from '@json-render/react'

import { Button } from './components/button'
import { Calculator } from './components/calculator'
import { Chart } from './components/chart'
import { Diagram } from './components/diagram'
import { Grid } from './components/grid'
import { Heading } from './components/heading'
import { Image } from './components/image'
import { InteractiveForm } from './components/interactive-form'
import { Simulation } from './components/simulation'
import { Stack } from './components/stack'
import { Table } from './components/table'
import { catalog } from './catalog'

export const { registry } = defineRegistry(catalog, {
  components: {
    Heading,
    Stack,
    Button,
    Grid,
    Image,
    Table,
    Chart,
    Diagram,
    Calculator,
    Simulation,
    InteractiveForm
  },
  actions: {
    submitQuery: async () => {
      // Handled by ActionProvider at runtime
    }
  }
})
