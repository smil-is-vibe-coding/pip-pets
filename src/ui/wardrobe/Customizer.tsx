import { useState } from 'react'
import { isUnlocked, unlockLevel } from '../../app/progress'
import { useApp } from '../../app/useStore'
import { type AppearanceInput, type CatAppearance, type EarShape, type EyeShape, type Pet, listAccessories, listPatterns } from '../../engine'
import { COATS, EYE_COLORS, randomAppearance } from './presets'

export type CustomTab = 'coat' | 'shape' | 'face' | 'extras'

const TABS: { id: CustomTab; label: string }[] = [
  { id: 'coat', label: '🎨 Coat' },
  { id: 'shape', label: '🐈 Shape' },
  { id: 'face', label: '👀 Face' },
  { id: 'extras', label: '🎀 Extras' },
]

function Slider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={0.01} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

function Swatches({ colors, value, onPick }: { colors: string[]; value: string; onPick: (c: string) => void }) {
  return (
    <div className="swatches">
      {colors.map((c) => (
        <button key={c} className={`swatch ${c === value ? 'on' : ''}`} style={{ background: c }} title={c} onClick={() => onPick(c)} />
      ))}
      <input type="color" value={value} onChange={(e) => onPick(e.target.value)} title="Custom color" />
    </div>
  )
}

const FURS = ['#f5a65b', '#2f2a33', '#fbf4ea', '#a9b0bd', '#efd7a8', '#8a5a3c', '#f3e6d3', '#d6d0c8']
const MARKINGS = ['#d9792f', '#3a2a26', '#5f5a55', '#fbf7f2', '#6b4a32', '#f0a050', '#5b4136']

/** Every appearance knob, grouped in tabs. Changes apply to the live cat instantly. */
export function Customizer({ pet, tabs = TABS.map((t) => t.id) }: { pet: Pet; tabs?: CustomTab[] }) {
  const [look, setLook] = useState<CatAppearance>(pet.appearance)
  const [tab, setTab] = useState<CustomTab>(tabs[0])
  const xp = useApp((s) => s.progress.xp)
  const apply = (input: AppearanceInput) => {
    pet.setAppearance(input)
    setLook(pet.appearance)
  }
  const eyeColor = Array.isArray(look.eyes.color) ? look.eyes.color[0] : look.eyes.color
  const hetero = Array.isArray(look.eyes.color)

  const hasAccessory = (id: string) => look.accessories.some((a) => a.id === id)
  const accessory = (id: string) => look.accessories.find((a) => a.id === id)
  const toggleAccessory = (id: string) =>
    apply({
      accessories: hasAccessory(id) ? look.accessories.filter((a) => a.id !== id) : [...look.accessories, { id, color: id === 'glasses' ? '#4a2f27' : '#e8505b', color2: '#ffd34e' }],
    })
  const recolor = (id: string, color: string) => apply({ accessories: look.accessories.map((a) => (a.id === id ? { ...a, color } : a)) })

  return (
    <div className="customizer">
      <div className="tabs" role="tablist">
        {TABS.filter((t) => tabs.includes(t.id)).map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
        <button className="chip dice" onClick={() => apply(randomAppearance())} title="Randomize everything">
          🎲
        </button>
      </div>

      {tab === 'coat' && (
        <div className="tab-body">
          <div className="coat-row">
            {COATS.map((c) => (
              <button key={c.label} className="chip" onClick={() => apply(c.look)}>
                {c.label}
              </button>
            ))}
          </div>
          <div className="field">
            <span>Fur</span>
            <Swatches colors={FURS} value={look.colors.fur} onPick={(c) => apply({ colors: { fur: c, furShade: undefined } })} />
          </div>
          <div className="grid2">
            <label className="field">
              <span>Pattern</span>
              <select value={look.pattern.id} onChange={(e) => apply({ pattern: { id: e.target.value } })}>
                {listPatterns().map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Belly</span>
              <input type="color" value={look.colors.belly} onChange={(e) => apply({ colors: { belly: e.target.value } })} />
            </label>
          </div>
          {look.pattern.id !== 'solid' && (
            <>
              <div className="field">
                <span>Markings</span>
                <Swatches colors={MARKINGS} value={look.pattern.color} onPick={(c) => apply({ pattern: { color: c } })} />
              </div>
              {look.pattern.id === 'calico' && (
                <div className="field">
                  <span>Second color</span>
                  <Swatches colors={MARKINGS} value={look.pattern.color2} onPick={(c) => apply({ pattern: { color2: c } })} />
                </div>
              )}
              <div className="grid2">
                <Slider label="Pattern amount" value={look.pattern.density} min={0} max={1} onChange={(v) => apply({ pattern: { density: v } })} />
                <button className="chip" onClick={() => apply({ pattern: { seed: Math.floor(Math.random() * 10000) } })}>
                  🔀 Shuffle markings
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'shape' && (
        <div className="tab-body grid2">
          <Slider label="Chubby" value={look.body.chubby} min={0} max={1} onChange={(v) => apply({ body: { chubby: v } })} />
          <Slider label="Body length" value={look.body.length} min={0.8} max={1.25} onChange={(v) => apply({ body: { length: v } })} />
          <Slider label="Head size" value={look.head.size} min={0.85} max={1.2} onChange={(v) => apply({ head: { size: v } })} />
          <Slider label="Cheeks" value={look.head.cheeks} min={0} max={1} onChange={(v) => apply({ head: { cheeks: v } })} />
          <Slider label="Cheek fluff" value={look.head.tufts} min={0} max={1} onChange={(v) => apply({ head: { tufts: v } })} />
          <label className="field">
            <span>Ears</span>
            <select value={look.ears.shape} onChange={(e) => apply({ ears: { shape: e.target.value as EarShape } })}>
              <option value="pointy">Pointy</option>
              <option value="round">Round</option>
              <option value="folded">Folded</option>
            </select>
          </label>
          <Slider label="Ear size" value={look.ears.size} min={0.65} max={1.35} onChange={(v) => apply({ ears: { size: v } })} />
          <Slider label="Leg length" value={look.legs.length} min={0.75} max={1.35} onChange={(v) => apply({ legs: { length: v } })} />
          <Slider label="Tail length" value={look.tail.length} min={0.6} max={1.5} onChange={(v) => apply({ tail: { length: v } })} />
          <Slider label="Tail fluff" value={look.tail.fluff} min={0} max={1} onChange={(v) => apply({ tail: { fluff: v } })} />
        </div>
      )}

      {tab === 'face' && (
        <div className="tab-body">
          <div className="field">
            <span>Eye color</span>
            <Swatches colors={EYE_COLORS} value={eyeColor} onPick={(c) => apply({ eyes: { color: hetero ? [c, (look.eyes.color as string[])[1]] : c } })} />
          </div>
          <label className="check">
            <input type="checkbox" checked={hetero} onChange={() => apply({ eyes: { color: hetero ? eyeColor : [eyeColor, eyeColor === '#6fb5ff' ? '#f2c94c' : '#6fb5ff'] } })} />
            Odd eyes (heterochromia)
          </label>
          <div className="grid2">
            <label className="field">
              <span>Eye shape</span>
              <select value={look.eyes.shape} onChange={(e) => apply({ eyes: { shape: e.target.value as EyeShape } })}>
                <option value="round">Round</option>
                <option value="almond">Almond</option>
                <option value="sleepy">Sleepy</option>
              </select>
            </label>
            <label className="field">
              <span>Nose</span>
              <input type="color" value={look.colors.nose} onChange={(e) => apply({ colors: { nose: e.target.value } })} />
            </label>
            <Slider label="Eye size" value={look.eyes.size} min={0.8} max={1.3} onChange={(v) => apply({ eyes: { size: v } })} />
            <Slider label="Pupils" value={look.eyes.pupil} min={0.45} max={0.95} onChange={(v) => apply({ eyes: { pupil: v } })} />
            <Slider label="Whiskers" value={look.face.whiskers} min={0} max={1.4} onChange={(v) => apply({ face: { whiskers: v } })} />
            <Slider label="Blush" value={look.face.blush} min={0} max={1} onChange={(v) => apply({ face: { blush: v } })} />
          </div>
        </div>
      )}

      {tab === 'extras' && (
        <div className="tab-body">
          <div className="accessory-grid">
            {listAccessories().map((a) => {
              const unlocked = isUnlocked(`acc:${a.id}`, xp)
              const on = hasAccessory(a.id)
              return (
                <div key={a.id} className={`accessory ${on ? 'on' : ''} ${unlocked ? '' : 'locked'}`}>
                  <button disabled={!unlocked} onClick={() => toggleAccessory(a.id)}>
                    {unlocked ? (on ? '✓ ' : '') + a.label : `🔒 ${a.label} · Lv ${unlockLevel(`acc:${a.id}`)}`}
                  </button>
                  {on && <input type="color" value={accessory(a.id)!.color} onChange={(e) => recolor(a.id, e.target.value)} title="Color" />}
                </div>
              )
            })}
          </div>
          <p className="muted small">Earn bond XP by caring for your cat and finishing tasks to unlock more.</p>
        </div>
      )}
    </div>
  )
}
