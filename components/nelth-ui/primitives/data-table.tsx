'use client'

import React, { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Search, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useNelthUI } from '../context'
import type { TableProps } from '@/lib/nelth-ui/types'

export function DataTableComponent({
  id,
  props
}: {
  id?: string
  props: TableProps
}) {
  const tableId = id || 'table-default'
  const {
    filterQuery,
    setFilterQuery,
    sortColumn,
    sortDirection,
    toggleSort,
    currentPage,
    setCurrentPage
  } = useNelthUI()

  const currentSearch = filterQuery[tableId] || ''
  const currentSortCol = sortColumn[tableId] || ''
  const currentSortDir = sortDirection[tableId] || 'asc'
  const page = currentPage[tableId] || 1
  const pageSize = props.pageSize || 10

  // 1. Filter rows
  const filteredRows = useMemo(() => {
    if (!props.searchable || !currentSearch.trim()) return props.rows
    const q = currentSearch.toLowerCase()
    return props.rows.filter(row =>
      Object.values(row).some(val =>
        String(val ?? '').toLowerCase().includes(q)
      )
    )
  }, [props.rows, props.searchable, currentSearch])

  // 2. Sort rows
  const sortedRows = useMemo(() => {
    if (!currentSortCol) return filteredRows
    return [...filteredRows].sort((a, b) => {
      const valA = a[currentSortCol]
      const valB = b[currentSortCol]
      if (valA == null && valB == null) return 0
      if (valA == null) return 1
      if (valB == null) return -1

      if (typeof valA === 'number' && typeof valB === 'number') {
        return currentSortDir === 'asc' ? valA - valB : valB - valA
      }
      const strA = String(valA)
      const strB = String(valB)
      return currentSortDir === 'asc'
        ? strA.localeCompare(strB, undefined, { numeric: true })
        : strB.localeCompare(strA, undefined, { numeric: true })
    })
  }, [filteredRows, currentSortCol, currentSortDir])

  // 3. Paginate
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const paginatedRows = useMemo(() => {
    if (sortedRows.length <= pageSize) return sortedRows
    const start = (page - 1) * pageSize
    return sortedRows.slice(start, start + pageSize)
  }, [sortedRows, page, pageSize])

  return (
    <div className="my-3 w-full rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden shadow-xs">
      {/* Header controls (Search & Summary) */}
      {props.searchable && (
        <div className="flex items-center justify-between p-3 border-b border-border/50 bg-muted/20">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filtrer les données..."
              value={currentSearch}
              onChange={e => setFilterQuery(tableId, e.target.value)}
              className="w-full pl-8 pr-3 py-1 text-xs rounded-lg border border-border/60 bg-background/80 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            {sortedRows.length} {sortedRows.length > 1 ? 'résultats' : 'résultat'}
          </div>
        </div>
      )}

      {/* Table container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40 text-muted-foreground font-medium">
              {props.columns.map(col => {
                const isCurrentSort = currentSortCol === col.key
                const canSort = col.sortable !== false

                return (
                  <th
                    key={col.key}
                    onClick={() => canSort && toggleSort(tableId, col.key)}
                    className={cn(
                      'px-3.5 py-2.5 font-semibold text-foreground/80 tracking-tight whitespace-nowrap',
                      canSort && 'cursor-pointer hover:bg-muted/70 select-none'
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col.label}</span>
                      {canSort && (
                        <ArrowUpDown
                          className={cn(
                            'w-3 h-3',
                            isCurrentSort ? 'text-primary' : 'text-muted-foreground/50'
                          )}
                        />
                      )}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {paginatedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={props.columns.length}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Aucune donnée trouvée
                </td>
              </tr>
            ) : (
              paginatedRows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className="hover:bg-muted/30 transition-colors duration-150"
                >
                  {props.columns.map(col => {
                    const rawVal = row[col.key]
                    return (
                      <td
                        key={col.key}
                        className="px-3.5 py-2.5 text-foreground/90 whitespace-nowrap"
                      >
                        {formatCellValue(rawVal, col.format)}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-border/50 bg-muted/20 text-xs text-muted-foreground">
          <span>
            Page {page} sur {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setCurrentPage(tableId, page - 1)}
              className="p-1 rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Page précédente"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setCurrentPage(tableId, page + 1)}
              className="p-1 rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Page suivante"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function formatCellValue(val: any, format?: string) {
  if (val == null) return <span className="text-muted-foreground">—</span>
  if (typeof val === 'boolean') {
    return val ? (
      <span className="text-emerald-500 font-medium">✓ Oui</span>
    ) : (
      <span className="text-muted-foreground">✕ Non</span>
    )
  }

  switch (format) {
    case 'currency':
      return typeof val === 'number'
        ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(val)
        : String(val)
    case 'number':
      return typeof val === 'number' ? val.toLocaleString('fr-FR') : String(val)
    case 'badge':
      return (
        <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium">
          {String(val)}
        </span>
      )
    default:
      return String(val)
  }
}
