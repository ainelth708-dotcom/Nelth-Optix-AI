import { Children, isValidElement, type ReactNode } from 'react'

/**
 * Extracts the plain text of a React node tree.
 *
 * `children.toString()` cannot be used for that: while the answer streams,
 * Streamdown wraps every word in an animated `<span>`, so the link children
 * are elements and `toString()` yields "[object Object]" instead of the
 * citation label. The label detection then fails and the citation falls back
 * to a plain link (no favicon).
 */
export function textFromChildren(children: ReactNode): string {
  if (
    children === null ||
    children === undefined ||
    typeof children === 'boolean'
  ) {
    return ''
  }
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (Array.isArray(children)) {
    return children.map(textFromChildren).join('')
  }
  if (isValidElement(children)) {
    const props = children.props as { children?: ReactNode }
    return textFromChildren(props.children)
  }
  return Children.toArray(children).map(textFromChildren).join('')
}
