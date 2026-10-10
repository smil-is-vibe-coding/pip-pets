import { useState } from 'react'
import { pet } from '../../app/game'
import { isUnlocked, unlockLevel } from '../../app/progress'
import { store } from '../../app/store'
import { useApp } from '../../app/useStore'
import { type Personality, getScene, listScenes } from '../../engine'
import { PetStage } from '../../react/PetStage'
import { Customizer } from './Customizer'
import { NAMES, PERSONALITIES } from './presets'

const TRAITS: { key: keyof Personality; low: string; high: string }[] = [
  { key: 'playful', low: 'Couch potato', high: 'Playful' },
  { key: 'lazy', low: 'Energetic', high: 'Lazy' },
  { key: 'cuddly', low: 'Independent', high: 'Cuddly' },
  { key: 'chaotic', low: 'Calm', high: 'Chaotic' },
  { key: 'foodie', low: 'Picky', high: 'Foodie' },
  { key: 'vocal', low: 'Quiet', high: 'Chatty' },
  { key: 'grumpy', low: 'Patient', high: 'Grumpy' },
]

export function NameField() {
  const [name, setName] = useState(pet.name)
  return (
    <div className="name-field">
      <input
        value={name}
        maxLength={20}
        aria-label="Name"
        onChange={(e) => {
          setName(e.target.value)
          if (e.target.value.trim()) pet.setName(e.target.value.trim())
        }}
      />
      <button className="chip" title="Suggest a name" onClick={() => {
        const n = NAMES[Math.floor(Math.random() * NAMES.length)]
        setName(n)
        pet.setName(n)
      }}>
        🎲
      </button>
    </div>
  )
}

export function PersonalityPicker({ showSliders = true }: { showSliders?: boolean }) {
  const [traits, setTraits] = useState(pet.personality)
  const apply = (p: Partial<Personality>) => {
    pet.setPersonality(p)
    setTraits(pet.personality)
  }
  return (
    <div className="personality">
      <div className="preset-cards">
        {PERSONALITIES.map((p) => {
          const on = Object.entries(p.traits).every(([k, v]) => Math.abs(traits[k as keyof Personality] - (v as number)) < 0.01)
          return (
            <button key={p.label} className={`preset-card ${on ? 'on' : ''}`} onClick={() => apply(p.traits)}>
              <span className="emoji">{p.emoji}</span>
              <strong>{p.label}</strong>
              <span className="muted small">{p.blurb}</span>
            </button>
          )
        })}
      </div>
      {showSliders && (
        <div className="grid2">
          {TRAITS.map((t) => (
            <label key={t.key} className="field trait">
              <span>
                {t.low} <span className="muted">↔</span> {t.high}
              </span>
              <input type="range" min={0} max={1} step={0.01} value={traits[t.key]} onChange={(e) => apply({ [t.key]: Number(e.target.value) })} />
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

export function ScenePicker() {
  const sceneId = useApp((s) => s.settings.sceneId)
  const xp = useApp((s) => s.progress.xp)
  return (
    <div className="scene-cards">
      {listScenes().map((sc) => {
        const unlocked = isUnlocked(`scene:${sc.id}`, xp)
        return (
          <button
            key={sc.id}
            disabled={!unlocked}
            className={`scene-card scene-${sc.id} ${sceneId === sc.id ? 'on' : ''}`}
            onClick={() => {
              store.set((s) => ({ ...s, settings: { ...s.settings, sceneId: sc.id } }))
              pet.setScene(getScene(sc.id))
            }}
          >
            <span className="emoji">{sc.id === 'bedroom' ? '🛏️' : sc.id === 'office' ? '💻' : '🌻'}</span>
            <strong>{sc.label}</strong>
            {!unlocked && <span className="muted small">🔒 Bond level {unlockLevel(`scene:${sc.id}`)}</span>}
          </button>
        )
      })}
    </div>
  )
}

export function Wardrobe() {
  return (
    <div className="wardrobe">
      <section className="stage-card">
        <PetStage pet={pet} className="stage" />
        <div className="stage-caption">
          <NameField />
          <span className="muted small">Changes save automatically.</span>
        </div>
      </section>
      <aside>
        <div className="panel">
          <Customizer pet={pet} />
        </div>
        <div className="panel">
          <h3>Personality</h3>
          <PersonalityPicker />
        </div>
        <div className="panel">
          <h3>Home</h3>
          <ScenePicker />
        </div>
      </aside>
    </div>
  )
}
