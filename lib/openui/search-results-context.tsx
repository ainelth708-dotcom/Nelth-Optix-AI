'use client'

import { createContext, type ReactNode, useContext, useState } from 'react'

import type { SearchResultImage, SearchResultItem } from '@/lib/types'

/**
 * Results of the web search preload, available as soon as the route runs them.
 * Inlined citations ([n]) resolve against these results so citation chips
 * appear while the answer still streams — not only after it finishes.
 */
export interface SearchResultsState {
  results: SearchResultItem[]
  query: string
  images: SearchResultImage[]
}

export const SearchResultsContext = createContext<
  | {
      results: SearchResultItem[]
      query: string
      images: SearchResultImage[]
      setResults: (
        results: SearchResultItem[],
        query: string,
        images: SearchResultImage[]
      ) => void
      clearResults: () => void
    }
  | undefined
>(undefined)

export function SearchResultsProvider({
  children,
  results,
  query,
  images,
  setResults
}: {
  children: ReactNode
  results: SearchResultItem[]
  query: string
  images: SearchResultImage[]
  setResults: (
    results: SearchResultItem[],
    query: string,
    images: SearchResultImage[]
  ) => void
}) {
  return (
    <SearchResultsContext.Provider
      value={{
        results,
        query,
        images,
        setResults,
        clearResults: () => setResults([], '', [])
      }}
    >
      {children}
    </SearchResultsContext.Provider>
  )
}

export function useSearchResults(): {
  results: SearchResultItem[]
  query: string
  images: SearchResultImage[]
  setResults: (
    results: SearchResultItem[],
    query: string,
    images: SearchResultImage[]
  ) => void
  clearResults: () => void
} {
  const context = useContext(SearchResultsContext)
  if (!context) {
    return {
      results: [],
      query: '',
      images: [],
      setResults: () => {},
      clearResults: () => {}
    }
  }
  return context
}
