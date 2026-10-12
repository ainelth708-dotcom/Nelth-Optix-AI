'use client'

import type { ComponentFn } from '@json-render/react'

import type { CatalogType } from './shared'

export const Table: ComponentFn<CatalogType, 'Table'> = ({ props }) => (
  <div className="my-3 w-full overflow-x-auto rounded-lg border">
    {props.title && (
      <div className="border-b px-3 py-2 text-sm font-semibold">
        {props.title}
      </div>
    )}
    <table className="w-full min-w-max border-collapse text-left text-sm">
      <thead>
        <tr className="bg-muted/50">
          {props.columns.map((column, index) => (
            <th
              key={`${column}-${index}`}
              scope="col"
              className="border-b px-3 py-2 font-semibold"
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {props.rows.map((row, rowIndex) => (
          <tr key={rowIndex} className="even:bg-muted/20">
            {row.map((cell, cellIndex) => (
              <td
                key={`${rowIndex}-${cellIndex}`}
                className="border-b px-3 py-2"
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)
