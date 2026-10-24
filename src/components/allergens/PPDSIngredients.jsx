import React from 'react'
import { labelIngredients } from '../../lib/ppdsLabel'

const Emph = ({ children }) => <strong style={{ textDecoration: 'underline' }}>{children}</strong>

/**
 * The ingredients of a PPDS label, with every allergen named and emphasised
 * (see lib/ppdsLabel). Used by the label, its preview and the edit form so
 * they can never disagree.
 */
export default function PPDSIngredients({ rows, empty = null }) {
  const items = labelIngredients(rows)
  if (!items.length) return empty
  return items.map((r, i) => (
    <React.Fragment key={i}>
      {r.emphasiseName ? <Emph>{r.name}</Emph> : r.name}
      {r.named.length > 0 && (
        <>
          {' ('}
          {r.named.map((a, j) => (
            <React.Fragment key={a}>
              <Emph>{a}</Emph>{j < r.named.length - 1 ? ', ' : ''}
            </React.Fragment>
          ))}
          {')'}
        </>
      )}
      {i < items.length - 1 ? ', ' : '.'}
    </React.Fragment>
  ))
}
