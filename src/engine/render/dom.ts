import { r2 } from '../core/math'
import type { Shape } from '../custom/shapes'

const NS = 'http://www.w3.org/2000/svg'
export type Attrs = Record<string, string | number>

/** Tiny DOM toolkit bound to one document (works in the PiP window too). */
export function createDom(doc: Document) {
  // Attribute writes are cached so idle frames touch the DOM as little as possible.
  const written = new WeakMap<Element, Record<string, string>>()
  const set = (e: Element, name: string, value: string | number) => {
    const v = typeof value === 'number' ? String(r2(value)) : value
    let rec = written.get(e)
    if (!rec) written.set(e, (rec = {}))
    if (rec[name] === v) return
    rec[name] = v
    e.setAttribute(name, v)
  }
  const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, parent?: Element): SVGElementTagNameMap[K] => {
    const e = doc.createElementNS(NS, tag)
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
    parent?.appendChild(e)
    return e
  }
  const drawShapes = (shapes: Shape[], parent: Element) =>
    shapes.map((s) =>
      el('path', {
        d: s.d,
        fill: s.fill ?? 'none',
        ...(s.stroke ? { stroke: s.stroke, 'stroke-width': s.strokeWidth ?? 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } : {}),
        ...(s.opacity !== undefined ? { opacity: s.opacity } : {}),
      }, parent),
    )
  return { doc, set, el, drawShapes }
}

export type Dom = ReturnType<typeof createDom>
