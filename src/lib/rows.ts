/** Replace rows with the same id, append new ones (one pass, so bulk imports stay fast). */
export function mergeRows<R extends { id: string }>(list: R[], rows: R[]): R[] {
  const incoming = new Map(rows.map((r) => [r.id, r]))
  const merged = list.map((r) => {
    const next = incoming.get(r.id)
    if (next) incoming.delete(r.id)
    return next ?? r
  })
  return [...merged, ...incoming.values()]
}
