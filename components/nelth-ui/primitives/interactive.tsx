'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { useNelthUI } from '../context'
import type {
  ButtonProps,
  InputProps,
  SelectProps,
  SliderProps,
  CheckboxProps,
  FormProps,
  FilterBarProps
} from '@/lib/nelth-ui/types'

export function ButtonComponent({
  id,
  props
}: {
  id?: string
  props: ButtonProps
}) {
  const { dispatchAction } = useNelthUI()

  const variantClass = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    outline: 'border border-border bg-transparent hover:bg-muted text-foreground',
    ghost: 'hover:bg-muted text-foreground'
  }[props.variant || 'default']

  return (
    <button
      id={id}
      disabled={props.disabled}
      onClick={() => {
        if (props.actionId) {
          dispatchAction(props.actionId, { id, label: props.label, ...(props.payload || {}) })
        }
      }}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98] text-xs sm:text-sm px-3.5 py-1.5 rounded-xl',
        variantClass
      )}
    >
      {props.label}
    </button>
  )
}

export function InputComponent({
  id,
  props
}: {
  id?: string
  props: InputProps
}) {
  const { formValues, setFormValue } = useNelthUI()
  const inputId = id || props.name
  const val = formValues['root']?.[inputId] ?? props.defaultValue ?? ''

  return (
    <div className="w-full space-y-1.5 my-2">
      {props.label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-foreground/85"
        >
          {props.label}
        </label>
      )}
      <input
        id={inputId}
        name={props.name}
        type={props.inputType || 'text'}
        placeholder={props.placeholder}
        required={props.required}
        value={val}
        onChange={e => setFormValue('root', inputId, e.target.value)}
        className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-border/70 bg-background/90 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1.5 focus:ring-primary transition-all duration-150"
      />
    </div>
  )
}

export function SelectComponent({
  id,
  props
}: {
  id?: string
  props: SelectProps
}) {
  const { formValues, setFormValue } = useNelthUI()
  const selectId = id || props.name
  const val = formValues['root']?.[selectId] ?? props.defaultValue ?? props.options[0]?.value ?? ''

  return (
    <div className="w-full space-y-1.5 my-2">
      {props.label && (
        <label
          htmlFor={selectId}
          className="block text-xs font-semibold text-foreground/85"
        >
          {props.label}
        </label>
      )}
      <select
        id={selectId}
        name={props.name}
        required={props.required}
        value={val}
        onChange={e => setFormValue('root', selectId, e.target.value)}
        className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-border/70 bg-background/90 text-foreground focus:outline-none focus:ring-1.5 focus:ring-primary cursor-pointer transition-all duration-150"
      >
        {props.options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export function SliderComponent({
  id,
  props
}: {
  id?: string
  props: SliderProps
}) {
  const { sliderValues, setSliderValue } = useNelthUI()
  const sliderId = id || props.name
  const min = props.min ?? 0
  const max = props.max ?? 100
  const step = props.step ?? 1
  const currentVal = sliderValues[sliderId] ?? props.defaultValue ?? min

  return (
    <div className="w-full space-y-1.5 my-2.5">
      <div className="flex items-center justify-between text-xs font-semibold text-foreground/85">
        {props.label && <span>{props.label}</span>}
        <span className="font-mono text-primary font-bold">{currentVal}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={currentVal}
        onChange={e => setSliderValue(sliderId, Number(e.target.value))}
        className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
      />
    </div>
  )
}

export function CheckboxComponent({
  id,
  props
}: {
  id?: string
  props: CheckboxProps
}) {
  const { checkedValues, setCheckedValue } = useNelthUI()
  const checkboxId = id || props.name
  const isChecked = checkedValues[checkboxId] ?? props.defaultChecked ?? false

  return (
    <label className="flex items-center gap-2.5 cursor-pointer my-2 select-none">
      <input
        type="checkbox"
        id={checkboxId}
        name={props.name}
        checked={isChecked}
        onChange={e => setCheckedValue(checkboxId, e.target.checked)}
        className="w-4 h-4 rounded border-border/70 text-primary focus:ring-primary accent-primary cursor-pointer"
      />
      <span className="text-xs sm:text-sm font-medium text-foreground/90">
        {props.label}
      </span>
    </label>
  )
}

export function FormComponent({
  id,
  props,
  children
}: {
  id?: string
  props: FormProps
  children?: React.ReactNode
}) {
  const formId = id || 'form-root'
  const { formValues, dispatchAction } = useNelthUI()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    dispatchAction(props.actionId, { formId, values: formValues['root'] || {} })
  }

  return (
    <form
      id={formId}
      onSubmit={handleSubmit}
      className="my-3 w-full rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-4 space-y-3"
    >
      {props.title && (
        <h4 className="text-sm font-semibold tracking-tight text-foreground border-b border-border/40 pb-2">
          {props.title}
        </h4>
      )}
      <div className="space-y-3">{children}</div>
      <div className="pt-2 flex justify-end">
        <button
          type="submit"
          className="px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs cursor-pointer"
        >
          {props.submitLabel || 'Valider'}
        </button>
      </div>
    </form>
  )
}

export function FilterBarComponent({
  id,
  props
}: {
  id?: string
  props: FilterBarProps
}) {
  const filterId = id || 'filter-bar'
  const { filterQuery, setFilterQuery } = useNelthUI()
  const currentSearch = filterQuery[filterId] || ''

  return (
    <div className="my-2 space-y-2">
      <input
        type="text"
        placeholder={props.searchPlaceholder || 'Filtrer...'}
        value={currentSearch}
        onChange={e => setFilterQuery(filterId, e.target.value)}
        className="w-full px-3 py-1.5 text-xs rounded-xl border border-border/60 bg-background/80 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      />
      {props.filters && props.filters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {props.filters.map(filter => (
            <div key={filter.key} className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground font-medium">
                {filter.label}:
              </span>
              <select
                value={filterQuery[`${filterId}-${filter.key}`] || ''}
                onChange={e => setFilterQuery(`${filterId}-${filter.key}`, e.target.value)}
                className="text-xs px-2 py-0.5 rounded-lg border border-border/60 bg-background text-foreground"
              >
                <option value="">Tous</option>
                {filter.options.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
