'use client'

import { type FormEvent, useState } from 'react'

import type { ComponentFn } from '@json-render/react'
import { toast } from 'sonner'

import { useChatContext } from '@/lib/contexts/chat-context'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import type { CatalogType } from './shared'

export const InteractiveForm: ComponentFn<CatalogType, 'InteractiveForm'> = ({
  props
}) => {
  const [values, setValues] = useState<string[]>(() =>
    props.fields.map(() => '')
  )
  const { sendMessage, isStreamingRef } = useChatContext()

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isStreamingRef.current) {
      toast.info('Attendez la fin de la réponse en cours.')
      return
    }

    const lines = props.fields.map(
      (field, index) => `${field.label}: ${values[index].trim()}`
    )
    const query = `Réponses au formulaire « ${props.title} » :\n${lines.join('\n')}`
    if (query.length > 4000) {
      toast.error('Les réponses sont trop longues pour être envoyées.')
      return
    }

    sendMessage({ role: 'user', parts: [{ type: 'text', text: query }] })
  }

  return (
    <form onSubmit={submit} className="my-3 grid gap-3 rounded-lg border p-4">
      <h3 className="text-sm font-semibold">{props.title}</h3>
      {props.fields.map((field, index) => (
        <label key={`${field.label}-${index}`} className="grid gap-1 text-sm">
          {field.label}
          {field.type === 'select' ? (
            <select
              required={field.required}
              value={values[index]}
              onChange={event =>
                setValues(current =>
                  current.map((value, itemIndex) =>
                    itemIndex === index ? event.target.value : value
                  )
                )
              }
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Sélectionnez…</option>
              {(field.options ?? []).map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <Input
              type={field.type}
              required={field.required}
              maxLength={field.type === 'text' ? 500 : undefined}
              value={values[index]}
              onChange={event =>
                setValues(current =>
                  current.map((value, itemIndex) =>
                    itemIndex === index ? event.target.value : value
                  )
                )
              }
            />
          )}
        </label>
      ))}
      <div>
        <Button type="submit">{props.submitLabel}</Button>
      </div>
    </form>
  )
}
