import { JSONUIProvider, Renderer } from '@json-render/react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { ChatProvider } from '@/lib/contexts/chat-context'

import { parseSpecBlock } from '../parse-spec-block'
import { registry } from '../registry'
import { nativeVisualElementSchema } from '../visual-schemas'

const spec = parseSpecBlock(
  [
    '{"op":"add","path":"/root","value":"main"}',
    '{"op":"add","path":"/elements/main","value":{"type":"Stack","props":{"direction":"vertical"},"children":["table","chart","diagram","calculator","simulation","form"]}}',
    '{"op":"add","path":"/elements/table","value":{"type":"Table","props":{"title":"Comparaison","columns":["Option","Prix"],"rows":[["A","10"],["B","20"]]},"children":[]}}',
    '{"op":"add","path":"/elements/chart","value":{"type":"Chart","props":{"title":"Prix par option","chartType":"bar","values":[{"label":"A","value":10},{"label":"B","value":20}]},"children":[]}}',
    '{"op":"add","path":"/elements/diagram","value":{"type":"Diagram","props":{"title":"Étapes","steps":[{"label":"Début"},{"label":"Fin"}]},"children":[]}}',
    '{"op":"add","path":"/elements/calculator","value":{"type":"Calculator","props":{"title":"Calculatrice","operation":"add","first":{"label":"Premier nombre","value":12},"second":{"label":"Deuxième nombre","value":8},"resultLabel":"Résultat"},"children":[]}}',
    '{"op":"add","path":"/elements/simulation","value":{"type":"Simulation","props":{"title":"Relation au carré","operation":"square","min":-10,"max":10,"step":1,"initialValue":2,"outputLabel":"Carré"},"children":[]}}',
    '{"op":"add","path":"/elements/form","value":{"type":"InteractiveForm","props":{"title":"Demande","submitLabel":"Envoyer à Nelth-IA","fields":[{"label":"Nom","type":"text","required":true}]},"children":[]}}'
  ].join('\n')
)

describe('native generative UI renderer', () => {
  test('renders structured components and updates calculator and chart controls', () => {
    render(
      <ChatProvider sendMessage={vi.fn()} isStreamingRef={{ current: false }}>
        <JSONUIProvider registry={registry} initialState={spec.state}>
          <Renderer spec={spec} registry={registry} />
        </JSONUIProvider>
      </ChatProvider>
    )

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('list').children).toHaveLength(2)
    expect(
      screen.getByText(
        (_, node) => node?.textContent?.replace(/\s+/g, '') === 'Résultat:20'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        (_, node) => node?.textContent?.replace(/\s+/g, '') === 'Carré:4'
      )
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Input: 2'), {
      target: { value: '3' }
    })
    expect(
      screen.getByText(
        (_, node) => node?.textContent?.replace(/\s+/g, '') === 'Carré:9'
      )
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Deuxième nombre'), {
      target: { value: '0' }
    })
    expect(
      screen.getByText(
        (_, node) => node?.textContent?.replace(/\s+/g, '') === 'Résultat:12'
      )
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'B' }))
    expect(
      screen
        .getByRole('region', { name: 'Prix par option' })
        .querySelector('p[aria-live]')
    ).toHaveTextContent('B: 20')
  })

  test('submits form data only after explicit user submission', () => {
    const sendMessage = vi.fn()
    render(
      <ChatProvider
        sendMessage={sendMessage}
        isStreamingRef={{ current: false }}
      >
        <JSONUIProvider registry={registry} initialState={spec.state}>
          <Renderer spec={spec} registry={registry} />
        </JSONUIProvider>
      </ChatProvider>
    )

    fireEvent.change(screen.getByLabelText('Nom'), {
      target: { value: 'Amina' }
    })
    expect(sendMessage).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Envoyer à Nelth-IA' }))
    expect(sendMessage).toHaveBeenCalledWith({
      role: 'user',
      parts: [
        {
          type: 'text',
          text: 'Réponses au formulaire « Demande » :\nNom: Amina'
        }
      ]
    })
  })

  test('rejects data that violates component invariants', () => {
    expect(
      nativeVisualElementSchema.safeParse({
        type: 'Table',
        props: { columns: ['A', 'B'], rows: [['only one cell']] }
      }).success
    ).toBe(false)
  })
})
