'use client'

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react'

export interface NelthUIContextState {
  filterQuery: Record<string, string>
  sortColumn: Record<string, string>
  sortDirection: Record<string, 'asc' | 'desc'>
  activeTabs: Record<string, string>
  currentPage: Record<string, number>
  formValues: Record<string, Record<string, any>>
  checkedValues: Record<string, boolean>
  sliderValues: Record<string, number>
  
  // Handlers
  setFilterQuery: (id: string, query: string) => void
  toggleSort: (id: string, column: string) => void
  setActiveTab: (id: string, tabId: string) => void
  setCurrentPage: (id: string, page: number) => void
  setFormValue: (formId: string, fieldId: string, value: any) => void
  setCheckedValue: (id: string, checked: boolean) => void
  setSliderValue: (id: string, value: number) => void
  dispatchAction: (actionName: string, payload?: Record<string, any>) => void
}

const NelthUIContext = createContext<NelthUIContextState | null>(null)

export function useNelthUI() {
  const ctx = useContext(NelthUIContext)
  if (!ctx) {
    throw new Error('useNelthUI must be used within a NelthUIContextProvider')
  }
  return ctx
}

export function NelthUIContextProvider({
  children,
  onAction
}: {
  children: React.ReactNode
  onAction?: (actionName: string, payload?: Record<string, any>) => void
}) {
  const [filterQuery, setFilterQueryState] = useState<Record<string, string>>({})
  const [sortColumn, setSortColumnState] = useState<Record<string, string>>({})
  const [sortDirection, setSortDirectionState] = useState<Record<string, 'asc' | 'desc'>>({})
  const [activeTabs, setActiveTabsState] = useState<Record<string, string>>({})
  const [currentPage, setCurrentPageState] = useState<Record<string, number>>({})
  const [formValues, setFormValuesState] = useState<Record<string, Record<string, any>>>({})
  const [checkedValues, setCheckedValuesState] = useState<Record<string, boolean>>({})
  const [sliderValues, setSliderValuesState] = useState<Record<string, number>>({})

  const setFilterQuery = useCallback((id: string, query: string) => {
    setFilterQueryState(prev => ({ ...prev, [id]: query }))
    setCurrentPageState(prev => ({ ...prev, [id]: 1 }))
  }, [])

  const toggleSort = useCallback((id: string, column: string) => {
    setSortColumnState(prevCol => {
      const isSame = prevCol[id] === column
      setSortDirectionState(prevDir => ({
        ...prevDir,
        [id]: isSame && prevDir[id] === 'asc' ? 'desc' : 'asc'
      }))
      return { ...prevCol, [id]: column }
    })
  }, [])

  const setActiveTab = useCallback((id: string, tabId: string) => {
    setActiveTabsState(prev => ({ ...prev, [id]: tabId }))
  }, [])

  const setCurrentPage = useCallback((id: string, page: number) => {
    setCurrentPageState(prev => ({ ...prev, [id]: page }))
  }, [])

  const setFormValue = useCallback((formId: string, fieldId: string, value: any) => {
    setFormValuesState(prev => ({
      ...prev,
      [formId]: { ...(prev[formId] || {}), [fieldId]: value }
    }))
  }, [])

  const setCheckedValue = useCallback((id: string, checked: boolean) => {
    setCheckedValuesState(prev => ({ ...prev, [id]: checked }))
  }, [])

  const setSliderValue = useCallback((id: string, value: number) => {
    setSliderValuesState(prev => ({ ...prev, [id]: value }))
  }, [])

  const dispatchAction = useCallback((actionName: string, payload?: Record<string, any>) => {
    if (onAction) {
      onAction(actionName, payload)
    } else {
      console.log(`[NelthUI Action] ${actionName}:`, payload)
    }
  }, [onAction])

  const contextValue = useMemo<NelthUIContextState>(() => ({
    filterQuery,
    sortColumn,
    sortDirection,
    activeTabs,
    currentPage,
    formValues,
    checkedValues,
    sliderValues,
    setFilterQuery,
    toggleSort,
    setActiveTab,
    setCurrentPage,
    setFormValue,
    setCheckedValue,
    setSliderValue,
    dispatchAction
  }), [
    filterQuery,
    sortColumn,
    sortDirection,
    activeTabs,
    currentPage,
    formValues,
    checkedValues,
    sliderValues,
    setFilterQuery,
    toggleSort,
    setActiveTab,
    setCurrentPage,
    setFormValue,
    setCheckedValue,
    setSliderValue,
    dispatchAction
  ])

  return (
    <NelthUIContext.Provider value={contextValue}>
      {children}
    </NelthUIContext.Provider>
  )
}

