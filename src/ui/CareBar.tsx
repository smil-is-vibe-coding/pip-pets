import type { CSSProperties } from 'react'
import { catAudio } from '../app/audio'
import { store } from '../app/store'
import { useApp } from '../app/useStore'
import type { Needs, Pet, PetSnapshot } from '../engine'

interface Props {
  pet: Pet
  snap: PetSnapshot
  compact?: boolean
}

/** Which button fixes which need (for hint badges). */
const BADGE_FOR: Partial<Record<keyof Needs, string>> = { fullness: 'feed', hydration: 'water', fun: 'play', energy: 'lights' }

/** Feed / water / play / lights / call, shared by the page and the PiP window. */
export function CareBar({ pet, snap, compact }: Props) {
  const sound = useApp((s) => s.settings.sound)
  const toggleSound = () => {
    store.set((s) => ({ ...s, settings: { ...s.settings, sound: !sound } }))
    catAudio.toggle(!sound)
  }
  const badge = (id: string) => (snap.hint && snap.hint.level >= 2 && BADGE_FOR[snap.hint.need] === id ? <span className={`badge l${snap.hint.level}`} /> : null)
  return (
    <div className={`care-bar ${compact ? 'compact' : ''}`}>
      <button title="Fill the food bowl" onClick={() => pet.feed('kibble')}>
        🍚{!compact && ' Feed'}
        {badge('feed')}
      </button>
      {!compact && (
        <button title="Give fish" onClick={() => pet.feed('fish')}>
          🐟 Fish
        </button>
      )}
      <button title="Give a treat" onClick={() => pet.feed('treat')}>
        🍪{!compact && ' Treat'}
      </button>
      <button title="Refill water" onClick={() => pet.refillWater()}>
        💧{!compact && ' Water'}
        {badge('water')}
      </button>
      <button title="Feather toy: move your cursor to play" className={snap.toyMode ? 'on' : ''} onClick={() => pet.setToyMode(!snap.toyMode)}>
        🪶{!compact && ' Play'}
        {badge('play')}
      </button>
      <button title="Lights" className={snap.lightsOff ? 'on' : ''} onClick={() => pet.setLights(snap.lightsOff)}>
        {snap.lightsOff ? '🌙' : '💡'}
        {!compact && (snap.lightsOff ? ' Lights on' : ' Lights off')}
        {badge('lights')}
      </button>
      {!compact && (
        <button title={`Call ${snap.name}`} onClick={() => pet.call()}>
          📣 Call
        </button>
      )}
      <button title={sound ? 'Mute cat sounds' : 'Turn on cat sounds'} className={sound ? 'on' : ''} onClick={toggleSound}>
        {sound ? '🔊' : '🔇'}
        {!compact && (sound ? ' Sound on' : ' Sound off')}
      </button>
    </div>
  )
}

const NEEDS: { key: keyof Needs; label: string; color: string; icon: string }[] = [
  { key: 'fullness', label: 'Food', color: '#f5a65b', icon: '🐟' },
  { key: 'hydration', label: 'Water', color: '#6fb5ff', icon: '💧' },
  { key: 'energy', label: 'Energy', color: '#8f86e0', icon: '🌙' },
  { key: 'affection', label: 'Love', color: '#ff6b8b', icon: '💕' },
  { key: 'fun', label: 'Fun', color: '#5cc8a8', icon: '🧶' },
]

const MOOD_EMOJI: Record<PetSnapshot['mood'], string> = {
  happy: '😸',
  content: '🙂',
  playful: '😼',
  sleepy: '😪',
  hungry: '🍽️',
  thirsty: '💧',
  grumpy: '😾',
  lonely: '🥺',
}

const HINT_TEXT: Record<keyof Needs, string> = {
  fullness: 'is hungry',
  hydration: 'is thirsty',
  energy: 'is sleepy',
  affection: 'wants some love',
  fun: 'is bored',
}

export function NeedsMeter({ snap, compact }: { snap: PetSnapshot; compact?: boolean }) {
  if (compact) {
    return (
      <div className="need-rings" title={`${snap.mood} · ${snap.action}`}>
        <span className="mood">{MOOD_EMOJI[snap.mood]}</span>
        {NEEDS.map((n) => (
          <span key={n.key} className="ring" style={{ '--v': snap.needs[n.key], '--c': n.color } as CSSProperties} title={`${n.label} ${Math.round(snap.needs[n.key])}`} />
        ))}
      </div>
    )
  }
  return (
    <div className="needs">
      <div className="mood-line">
        <span className="mood big">{MOOD_EMOJI[snap.mood]}</span>
        <div>
          <strong>{snap.name}</strong> is feeling <strong>{snap.mood}</strong>
          <div className="muted small">
            {snap.hint && snap.hint.level >= 2 ? `${NEEDS.find((n) => n.key === snap.hint!.need)?.icon} ${snap.name} ${HINT_TEXT[snap.hint.need]}` : snap.asleep ? '💤 sleeping' : `doing: ${snap.action}`}
          </div>
        </div>
      </div>
      {NEEDS.map((n) => (
        <div key={n.key} className="need">
          <span>{n.label}</span>
          <div className="bar">
            <div style={{ width: `${snap.needs[n.key]}%`, background: n.color }} />
          </div>
          <span className="num">{Math.round(snap.needs[n.key])}</span>
        </div>
      ))}
    </div>
  )
}
