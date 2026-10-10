import { r2 } from '../core/math'
import type { Particle } from '../effects'
import type { Pet } from '../pet'
import type { Dom } from './dom'

/** Hearts, Zzz, sparkles, thought bubbles… drawn from the pet's particle list. */
export function createParticleRenderer(dom: Dom, particleG: SVGGElement, pet: Pet) {
  const { el, set } = dom
  const particleEls = new Map<number, SVGGElement>()
  const buildParticle = (p: Particle): SVGGElement => {
    const g = el('g', {}, particleG)
    const oc = pet.body.geometry.colors.outline
    switch (p.kind) {
      case 'heart':
        el('path', { d: 'M0 4C-6 -1 -7 -6 -3.5 -7C-1.5 -7.5 0 -6 0 -4.5C0 -6 1.5 -7.5 3.5 -7C7 -6 6 -1 0 4Z', fill: '#ff6b8b', stroke: oc, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }, g)
        break
      case 'z': {
        const t = el('text', { 'font-size': 14, 'font-weight': 800, 'font-family': 'system-ui, sans-serif', fill: '#8f86e0', stroke: '#ffffff', 'stroke-width': 3, 'paint-order': 'stroke', 'text-anchor': 'middle' }, g)
        t.textContent = 'z'
        break
      }
      case 'sparkle':
        el('path', { d: 'M0 -7Q1 -1 7 0Q1 1 0 7Q-1 1 -7 0Q-1 -1 0 -7Z', fill: '#ffd34e', stroke: oc, 'stroke-width': 1, 'stroke-linejoin': 'round' }, g)
        break
      case 'puff':
        for (const [x, y, r] of [[-5, 0, 5], [4, -2, 6], [0, 4, 4.5]]) el('circle', { cx: x, cy: y, r, fill: '#ffffff', stroke: '#d9d0e0', 'stroke-width': 1 }, g)
        break
      case 'note': {
        const t = el('text', { 'font-size': 15, 'font-weight': 700, fill: '#7aa7ff', stroke: '#ffffff', 'stroke-width': 3, 'paint-order': 'stroke', 'text-anchor': 'middle' }, g)
        t.textContent = '♪'
        break
      }
      case 'anger':
        el('path', { d: 'M-2 -2Q-2 -6 -6 -6M2 -2Q2 -6 6 -6M-2 2Q-2 6 -6 6M2 2Q2 6 6 6', stroke: '#e5484d', 'stroke-width': 2.4, 'stroke-linecap': 'round', fill: 'none' }, g)
        break
      case 'crumb':
        el('circle', { r: 1.6, fill: '#b5763a' }, g)
        break
      case 'exclaim': {
        const t = el('text', { 'font-size': 18, 'font-weight': 900, fill: '#ff8a3d', stroke: '#ffffff', 'stroke-width': 3, 'paint-order': 'stroke', 'text-anchor': 'middle' }, g)
        t.textContent = '!'
        break
      }
      case 'thought': {
        el('circle', { cx: -14, cy: 14, r: 2.2, fill: '#fff', stroke: oc, 'stroke-width': 1.2 }, g)
        el('circle', { cx: -9, cy: 9, r: 3.2, fill: '#fff', stroke: oc, 'stroke-width': 1.2 }, g)
        el('ellipse', { cx: 0, cy: -4, rx: 14, ry: 11, fill: '#fff', stroke: oc, 'stroke-width': 1.5 }, g)
        const icon = el('g', { transform: 'translate(0 -4)' }, g)
        if (p.icon === 'fish') {
          el('path', { d: 'M-7 0Q-2 -5 4 0Q-2 5 -7 0ZM4 0L8 -3.5L8 3.5Z', fill: '#7ec8ff', stroke: oc, 'stroke-width': 1, 'stroke-linejoin': 'round' }, icon)
          el('circle', { cx: -3.5, cy: -0.6, r: 0.9, fill: oc }, icon)
        } else if (p.icon === 'heart') {
          el('path', { d: 'M0 4C-6 -1 -7 -6 -3.5 -7C-1.5 -7.5 0 -6 0 -4.5C0 -6 1.5 -7.5 3.5 -7C7 -6 6 -1 0 4Z', fill: '#ff6b8b', stroke: oc, 'stroke-width': 1, transform: 'translate(0 1.5) scale(0.9)' }, icon)
        } else if (p.icon === 'yarn') {
          el('circle', { r: 6, fill: '#b58cff', stroke: oc, 'stroke-width': 1 }, icon)
          el('path', { d: 'M-5 -2Q0 1 5 -3M-4.5 2Q0 4 5 1M-2 -5.5Q1 0 -1 5.5', stroke: '#6f4bd8', 'stroke-width': 0.9, fill: 'none' }, icon)
        } else if (p.icon === 'water') {
          el('path', { d: 'M0 -7Q6 0 5 3A5 5 0 0 1 -5 3Q-6 0 0 -7Z', fill: '#7ec8ff', stroke: oc, 'stroke-width': 1 }, icon)
          el('circle', { cx: -1.8, cy: 1.5, r: 1.2, fill: '#ffffff' }, icon)
        } else {
          el('path', { d: 'M2 -6A6 6 0 1 0 6 3A5 5 0 1 1 2 -6Z', fill: '#ffd34e', stroke: oc, 'stroke-width': 1 }, icon)
        }
        break
      }
    }
    return g
  }

  function renderParticles() {
    const alive = new Set<number>()
    for (const p of pet.effects.list) {
      alive.add(p.id)
      let g = particleEls.get(p.id)
      if (!g) particleEls.set(p.id, (g = buildParticle(p)))
      set(g, 'transform', `translate(${r2(p.x)} ${r2(p.y)}) rotate(${r2(p.rot)}) scale(${r2(Math.max(0.01, p.scale))})`)
      set(g, 'opacity', p.alpha)
    }
    for (const [id, g] of particleEls) {
      if (!alive.has(id)) {
        g.remove()
        particleEls.delete(id)
      }
    }
  }

  return { render: renderParticles }
}
